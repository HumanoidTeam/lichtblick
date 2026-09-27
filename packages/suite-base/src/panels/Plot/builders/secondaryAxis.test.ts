// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Humanoid: independent Y-axis routing and raw-observation regression coverage.
import { unwrap } from "@lichtblick/den/monads";
import { parseMessagePath } from "@lichtblick/message-path";

import { CustomDatasetsBuilderImpl } from "./CustomDatasetsBuilderImpl";
import { SeriesConfigKey, SeriesItem, Viewport } from "./IDatasetsBuilder";
import { TimestampDatasetsBuilderImpl } from "./TimestampDatasetsBuilderImpl";
import { setSeries } from "./utils";
import { Dataset } from "../types";

const viewport: Viewport = { bounds: {}, size: { width: 800, height: 400 } };
const series: SeriesItem = {
  key: "pressure" as SeriesConfigKey,
  configIndex: 2,
  messagePath: "/sensor.pressure",
  parsed: unwrap(parseMessagePath("/sensor.pressure")),
  color: "black",
  contrastColor: "white",
  enabled: true,
  timestampMethod: "receiveTime",
  showLine: true,
  lineSize: 1,
};

type Builder = {
  configure: (config: SeriesItem) => void;
  dataset: () => Dataset | undefined;
};

const builders: { name: string; create: () => Builder }[] = [
  {
    name: "timestamp",
    create: () => {
      const builder = new TimestampDatasetsBuilderImpl();
      return {
        configure: (config) => {
          builder.applyActions([{ type: "update-series-config", seriesItems: [config] }]);
        },
        dataset: () => builder.getViewportDatasets(viewport)[2],
      };
    },
  },
  {
    name: "accumulated XY",
    create: () => {
      const builder = new CustomDatasetsBuilderImpl();
      return {
        configure: (config) => {
          builder.updateData([{ type: "update-series-config", seriesItems: [config] }]);
        },
        dataset: () => builder.getViewportDatasets(viewport).datasetsByConfigIndex[2],
      };
    },
  },
  {
    name: "shared index and latest XY",
    create: () => {
      let items: ReturnType<typeof setSeries> = new Map();
      return {
        configure: (config) => {
          items = setSeries(items, [config]);
        },
        dataset: () => items.get(series.key)?.dataset,
      };
    },
  },
];

describe.each(builders)("$name Y-axis assignment", ({ create }) => {
  it("keeps legacy defaults and original slots, and switches right then back without stale routing", () => {
    const builder = create();
    builder.configure(series);
    expect(builder.dataset()?.yAxisID ?? "y").toBe("y");
    builder.configure({ ...series, yAxisID: "yRight" });
    expect(builder.dataset()?.yAxisID).toBe("yRight");
    builder.configure(series);
    expect(builder.dataset()?.yAxisID ?? "y").toBe("y");
    builder.configure({ ...series, yAxisID: "yRight", showLine: false });
    expect(builder.dataset()).toMatchObject({ yAxisID: "yRight", showLine: false });
  });
});

const samples = [1100, 1400, 1800].map((value, index) => ({
  x: index,
  y: value,
  value,
  receiveTime: { sec: index, nsec: 123 },
  headerStamp: { sec: index, nsec: 456 },
}));

it.each([
  { timestampMethod: "receiveTime" as const, derivative: false },
  { timestampMethod: "receiveTime" as const, derivative: true },
  { timestampMethod: "headerStamp" as const, derivative: false },
  { timestampMethod: "headerStamp" as const, derivative: true },
])(
  "preserves $timestampMethod observations/gaps/CSV, derivative=$derivative",
  ({ timestampMethod, derivative }) => {
    const builder = new TimestampDatasetsBuilderImpl();
    const config = {
      ...series,
      timestampMethod,
      parsed: { ...series.parsed, modifier: derivative ? "derivative" : undefined },
    };
    builder.applyActions([
      { type: "update-series-config", seriesItems: [config] },
      { type: "append-full", series: series.key, items: samples.slice(0, 2) },
      { type: "append-current", series: series.key, items: samples.slice(2) },
    ]);
    const original = builder.getViewportDatasets(viewport)[2]!;
    const csv = builder.getCsvData().map((d) => ({ ...d, data: d.data.map((p) => ({ ...p })) }));
    expect(csv[0]?.data).toMatchObject(samples);
    expect(original.data).toHaveLength(derivative ? 3 : 4);
    expect(original.data[derivative ? 1 : 2]).toEqual({ x: NaN, y: NaN, value: NaN });
    expect(original.data.filter((p) => !isNaN(p.y)).map((p) => p.y)).toEqual(
      derivative ? [300, 400] : samples.map((p) => p.y),
    );
    builder.applyActions([
      { type: "update-series-config", seriesItems: [{ ...config, yAxisID: "yRight" }] },
    ]);
    expect(builder.getViewportDatasets(viewport)[2]).toMatchObject({
      yAxisID: "yRight",
      data: original.data,
    });
    expect(builder.getCsvData()).toEqual(csv);
  },
);

describe.each([undefined, { min: 1000, max: 2000 }])("right bounds %j", (yRight) => {
  const disjointViewport: Viewport = {
    bounds: { x: { min: 0, max: 2 }, y: { min: 0, max: 1e9 }, yRight },
    size: { width: 1, height: 400 },
  };

  it("uses right-axis pixel buckets for timestamp scatter, not the left domain", () => {
    const builder = new TimestampDatasetsBuilderImpl();
    builder.applyActions([
      {
        type: "update-series-config",
        seriesItems: [{ ...series, yAxisID: "yRight", showLine: false }],
      },
      { type: "append-full", series: series.key, items: samples },
    ]);
    expect(builder.getViewportDatasets(disjointViewport)[2]?.data).toHaveLength(3);
    expect(builder.getCsvData()[0]?.data).toHaveLength(3);
  });

  it("uses right-axis pixel buckets for accumulated XY scatter, not the left domain", () => {
    const builder = new CustomDatasetsBuilderImpl();
    builder.updateData([
      {
        type: "update-series-config",
        seriesItems: [{ ...series, yAxisID: "yRight", showLine: false }],
      },
      {
        type: "append-full-x",
        items: samples.map((s) => ({ value: s.x, originalValue: s.x, receiveTime: s.receiveTime })),
      },
      {
        type: "append-full",
        series: series.key,
        items: samples.map((s) => ({ value: s.y, originalValue: s.y, receiveTime: s.receiveTime })),
      },
    ]);
    const data = builder.getViewportDatasets(disjointViewport).datasetsByConfigIndex[2]?.data;
    expect(data).toHaveLength(3);
    expect(data?.every((p) => p.y >= 1100)).toBe(true);
    expect(builder.getCsvData()[0]?.data).toHaveLength(3);
  });
});
