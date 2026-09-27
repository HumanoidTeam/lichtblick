// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { unwrap } from "@lichtblick/den/monads";
import { parseMessagePath } from "@lichtblick/message-path";

import { CustomDatasetsBuilderImpl } from "./CustomDatasetsBuilderImpl";
import { SeriesConfigKey, SeriesItem, Viewport } from "./IDatasetsBuilder";
import { TimestampDatasetsBuilderImpl } from "./TimestampDatasetsBuilderImpl";
import { setSeries } from "./utils";
import { Dataset } from "../types";

const viewport: Viewport = { bounds: {}, size: { width: 800, height: 400 } };
const series: SeriesItem = {
  key: "mode" as SeriesConfigKey,
  configIndex: 0,
  messagePath: "/state.mode",
  parsed: unwrap(parseMessagePath("/state.mode")),
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
        dataset: () => builder.getViewportDatasets(viewport)[0],
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
        dataset: () => builder.getViewportDatasets(viewport).datasetsByConfigIndex[0],
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

describe.each(builders)("$name line interpolation", ({ create }) => {
  it("keeps legacy layouts linear, holds steps until the next sample, and can switch back", () => {
    const builder = create();
    builder.configure(series);
    expect(builder.dataset()?.stepped ?? false).toBe(false);

    const step = { ...series, lineInterpolation: "step" as const };
    builder.configure(step);
    expect(builder.dataset()?.stepped).toBe("before");

    const linear = { ...series, lineInterpolation: "linear" as const };
    builder.configure(linear);
    expect(builder.dataset()?.stepped ?? false).toBe(false);

    builder.configure(step);
    builder.configure(series);
    expect(builder.dataset()?.stepped ?? false).toBe(false);

    builder.configure({ ...step, showLine: false });
    expect(builder.dataset()?.showLine).toBe(false);
  });
});

it("preserves timestamp samples, preload gaps, and CSV data when interpolation changes", () => {
  const builder = new TimestampDatasetsBuilderImpl();
  const samples = [0, 1, 0].map((value, index) => ({
    x: index * 2,
    y: value,
    value,
    receiveTime: { sec: index * 2, nsec: 0 },
  }));
  builder.applyActions([
    { type: "update-series-config", seriesItems: [series] },
    { type: "append-full", series: series.key, items: samples.slice(0, 2) },
    { type: "append-current", series: series.key, items: samples.slice(2) },
  ]);
  const original = builder.getViewportDatasets(viewport)[0]!;
  const csv = builder.getCsvData();
  expect(original.data).toEqual([
    { x: samples[0]!.x, y: samples[0]!.y, value: samples[0]!.value },
    { x: samples[1]!.x, y: samples[1]!.y, value: samples[1]!.value },
    { x: NaN, y: NaN, value: NaN },
    { x: samples[2]!.x, y: samples[2]!.y, value: samples[2]!.value },
  ]);
  builder.applyActions([
    { type: "update-series-config", seriesItems: [{ ...series, lineInterpolation: "step" }] },
  ]);
  const stepped = builder.getViewportDatasets(viewport)[0]!;
  expect(stepped.stepped).toBe("before");
  expect(stepped.data).toEqual(original.data);
  expect(builder.getCsvData()).toEqual(csv);
});
