// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2026 Humanoid

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { unwrap } from "@lichtblick/den/monads";
import { makeComlinkWorkerMock } from "@lichtblick/den/testing";
import { parseMessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";

import { SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";
import { TimestampDatasetsBuilder } from "./TimestampDatasetsBuilder";
import { TimestampDatasetsBuilderImpl } from "./TimestampDatasetsBuilderImpl";

Object.defineProperty(global, "Worker", {
  writable: true,
  value: makeComlinkWorkerMock(() => new TimestampDatasetsBuilderImpl()),
});

const viewport = { size: { width: 1000, height: 400 }, bounds: {} };
const startTime = { sec: 100, nsec: 0 };
function series(value = "/sample.values[2:4]", extra: Partial<SeriesItem> = {}): SeriesItem {
  return {
    key: value as SeriesConfigKey,
    configIndex: 0,
    messagePath: value,
    parsed: unwrap(parseMessagePath(value)),
    color: "red",
    contrastColor: "blue",
    lineSize: 1,
    showLine: true,
    enabled: true,
    timestampMethod: "receiveTime",
    ...{ expandArrays: true },
    ...extra,
  };
}
function message(sec: number, values: unknown, headerSec?: number): MessageEvent {
  return {
    topic: "/sample",
    schemaName: "sample",
    receiveTime: { sec: 100 + sec, nsec: 0 },
    sizeInBytes: 0,
    message: {
      values,
      scalar: 42,
      ...(headerSec == undefined ? {} : { header: { stamp: { sec: 100 + headerSec, nsec: 0 } } }),
    },
  };
}

// Check finite observations separately from the explicit rendering-only gap sentinels.
const points = (data: readonly { x: number; y: number }[]) =>
  data
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map(({ x, y }) => [x, y]);

it("keeps source indices, gaps, following scalar identity and per-index CSV without changing config", async () => {
  const builder = new TimestampDatasetsBuilder();
  const config = [
    series(),
    series("/sample.scalar", { configIndex: 1, ...{ expandArrays: false } }),
  ];
  const original = structuredClone(config);
  builder.setSeries(config);
  builder.handleMessageRange(
    [
      message(0, [90, 90, 2, 30, 40]),
      message(1, [90, 90, 3]),
      message(2, []),
      message(3, [90, 90, 5, 33, 43]),
      message(4, [90, 90, 6, 34, 44]),
    ],
    { isReset: true },
    startTime,
  );
  const result = await builder.getViewportDatasets(viewport);
  expect(result.datasetsByConfigIndex[0]).toBeUndefined();
  expect(points(result.datasetsByConfigIndex[1]!.data)).toEqual([
    [0, 42],
    [1, 42],
    [2, 42],
    [3, 42],
    [4, 42],
  ]);
  expect(result.arrayDatasets?.map((item) => [item.configIndex, item.arrayIndex])).toEqual([
    [0, 2],
    [0, 3],
    [0, 4],
  ]);
  expect(points(result.arrayDatasets![0]!.dataset.data)).toEqual([
    [0, 2],
    [1, 3],
    [3, 5],
    [4, 6],
  ]);
  expect(result.arrayDatasets![0]!.dataset.data.some((p) => Number.isNaN(p.x))).toBe(true);
  expect(points(result.arrayDatasets![1]!.dataset.data)).toEqual([
    [0, 30],
    [3, 33],
    [4, 34],
  ]);
  const csv = await builder.getCsvData();
  expect(csv.map((item) => item.label)).toEqual([
    "/sample.scalar",
    "/sample.values[2]",
    "/sample.values[3]",
    "/sample.values[4]",
  ]);
  expect(csv[1]!.data.map(({ x, y }) => [x, y])).toEqual([
    [0, 2],
    [1, 3],
    [3, 5],
    [4, 6],
  ]);
  expect(csv[1]!.data.map((item) => item.receiveTime.sec)).toEqual([100, 101, 103, 104]);
  expect(config).toEqual(original);
});

it("computes derivatives per source index and per observed segment", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series("/sample.values[2:3].@derivative")]);
  builder.handleMessageRange(
    [
      message(0, [0, 0, 0, 100]),
      message(1, [0, 0, 2, 110]),
      message(2, []),
      message(3, [0, 0, 50, 900]),
      message(4, [0, 0, 53, 920]),
    ],
    { isReset: true },
    startTime,
  );
  const result = await builder.getViewportDatasets(viewport);
  expect(result.arrayDatasets?.map(({ dataset }) => points(dataset.data))).toEqual([
    [
      [1, 2],
      [4, 3],
    ],
    [
      [1, 10],
      [4, 20],
    ],
  ]);
});

it("sorts header clocks within segments, preserving duplicate ordering and missing-header breaks", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series("/sample.values[2:2]", { timestampMethod: "headerStamp" })]);
  builder.handleMessageRange(
    [
      message(0, [0, 0, 20], 2),
      message(1, [0, 0, 10], 1),
      message(2, [0, 0, 11], 1),
      message(3, [0, 0, 999]),
      message(4, [0, 0, 50], 5),
      message(5, [0, 0, 40], 4),
    ],
    { isReset: true },
    startTime,
  );
  const result = await builder.getViewportDatasets(viewport);
  expect(points(result.arrayDatasets![0]!.dataset.data)).toEqual([
    [1, 10],
    [1, 11],
    [2, 20],
    [4, 40],
    [5, 50],
  ]);
  expect(result.arrayDatasets![0]!.dataset.data.some((p) => Number.isNaN(p.x))).toBe(true);
});

it("leaves the default flattened timestamp series unchanged", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series("/sample.values[2:3]", { ...{ expandArrays: false } })]);
  builder.handleMessageRange([message(0, [0, 0, 2, 3])], { isReset: true }, startTime);
  const result = await builder.getViewportDatasets(viewport);
  expect(points(result.datasetsByConfigIndex[0]!.data)).toEqual([
    [0, 2],
    [0, 3],
  ]);
  expect(result.arrayDatasets).toBeUndefined();
});

it("discovers growing typed arrays in numeric order without recoloring existing indices", async () => {
  const builder = new TimestampDatasetsBuilder();
  const config = series("/sample.values[2:12]");
  builder.setSeries([config]);
  builder.handleMessageRange(
    [message(0, new Float64Array([0, 0, 2]))],
    { isReset: true },
    startTime,
  );
  const before = await builder.getViewportDatasets(viewport);
  builder.handleMessageRange(
    [
      message(
        1,
        Float64Array.from({ length: 13 }, (_, index) => index),
      ),
    ],
    { isReset: false },
    startTime,
  );
  const after = await builder.getViewportDatasets(viewport);
  expect(after.arrayDatasets?.map((item) => item.arrayIndex)).toEqual([
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  expect(after.arrayDatasets![0]!.color).toBe(before.arrayDatasets![0]!.color);
  expect(points(after.arrayDatasets![0]!.dataset.data)).toEqual([
    [0, 2],
    [1, 2],
  ]);
  expect(points(after.arrayDatasets![10]!.dataset.data)).toEqual([[1, 12]]);
  builder.setSeries([{ ...config, enabled: false }]);
  expect(
    (await builder.getViewportDatasets(viewport)).arrayDatasets?.every(
      ({ dataset }) => dataset.data.length === 0,
    ),
  ).toBe(true);
  expect(await builder.getCsvData()).toEqual([]);
  builder.setSeries([{ ...config, enabled: true, arrayColor: "purple" }]);
  const restored = await builder.getViewportDatasets(viewport);
  expect(restored.arrayDatasets?.every((item) => item.color === "purple")).toBe(true);
  expect(points(restored.arrayDatasets![0]!.dataset.data)).toEqual([
    [0, 2],
    [1, 2],
  ]);
});

it("resets range samples and removes children when the configured path changes", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series()]);
  builder.handleMessageRange([message(0, [0, 0, 2, 3, 4])], { isReset: true }, startTime);
  await builder.getViewportDatasets(viewport);
  builder.handleMessageRange([message(5, [0, 0, 52])], { isReset: true }, startTime);
  const reset = await builder.getViewportDatasets(viewport);
  expect(reset.arrayDatasets?.map(({ dataset }) => points(dataset.data))).toEqual([
    [[5, 52]],
    [],
    [],
  ]);
  builder.setSeries([series("/sample.other[2:4]")]);
  const changed = await builder.getViewportDatasets(viewport);
  expect(changed.arrayDatasets).toEqual([]);
  expect(await builder.getCsvData()).toEqual([]);
});

it("keeps current/preload gaps and immediate CSV does not lose undispatched observations", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series()]);
  builder.handlePlayerState(
    PlayerBuilder.playerState({
      activeData: PlayerBuilder.activeData({
        startTime,
        endTime: { sec: 102, nsec: 0 },
        messages: [message(0, [0, 0, 2, 3]), message(2, [0, 0, 4, 5])],
      }),
    }),
  );
  expect((await builder.getCsvData()).map((item) => item.data.length)).toEqual([2, 2]);
  builder.handleMessageRange([message(0, [0, 0, 2, 3])], { isReset: true }, startTime);
  const mixed = await builder.getViewportDatasets(viewport);
  expect(points(mixed.arrayDatasets![0]!.dataset.data)).toEqual([
    [0, 2],
    [2, 4],
  ]);
  expect(mixed.arrayDatasets![0]!.dataset.data.some((item) => Number.isNaN(item.x))).toBe(true);
  expect((await builder.getCsvData())[0]!.data.length).toBe(2);
});

it("preserves gaps under downsampling and exports only actual finite observations", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series("/sample.values[2:2]")]);
  const events = Array.from({ length: 300 }, (_, index) =>
    message(index, [0, 0, index >= 100 && index < 200 ? NaN : index]),
  );
  builder.handleMessageRange(events, { isReset: true }, startTime);
  const result = await builder.getViewportDatasets({
    size: { width: 30, height: 100 },
    bounds: {},
  });
  const data = result.arrayDatasets![0]!.dataset.data;
  const gap = data.findIndex((item) => Number.isNaN(item.x));
  expect(gap).toBeGreaterThan(0);
  expect(data.slice(0, gap).every((item) => item.x < 100)).toBe(true);
  expect(data.slice(gap + 1).every((item) => item.x >= 200)).toBe(true);
  const csv = (await builder.getCsvData())[0]!;
  expect(csv.data.length).toBe(200);
  expect(csv.data.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
});

it.each([
  "/sample.values[:].field",
  "/sample.values[-2:-1]",
  "/sample.values[:].nested[:]",
])("visibly rejects unsupported source identity %s", async (path) => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([series(path)]);
  builder.handleMessageRange([message(0, [0, 0, 2, 3])], { isReset: true }, startTime);
  const result = await builder.getViewportDatasets(viewport);
  expect(result.arrayDatasets).toEqual([]);
  expect(result.pathsWithInvalidArrays).toEqual(new Set([path]));
});

it("uses fractional header time, bigint values and math modifiers independently in scatter mode", async () => {
  const builder = new TimestampDatasetsBuilder();
  builder.setSeries([
    series("/sample.values[2:3].@abs", { timestampMethod: "headerStamp", showLine: false }),
  ]);
  const event = message(7, []);
  event.message = { values: [0, 0, -2n, -3.5], header: { stamp: { sec: 101, nsec: 125_000_000 } } };
  const original = structuredClone(event);
  builder.handleMessageRange([event], { isReset: true }, startTime);
  const result = await builder.getViewportDatasets(viewport);
  expect(result.arrayDatasets?.map(({ dataset }) => points(dataset.data))).toEqual([
    [[1.125, 2]],
    [[1.125, 3.5]],
  ]);
  expect(result.arrayDatasets?.every(({ dataset }) => dataset.showLine === false)).toBe(true);
  const csv = await builder.getCsvData();
  expect(csv[0]!.data[0]).toMatchObject({
    x: 1.125,
    y: 2,
    value: 2,
    receiveTime: { sec: 107, nsec: 0 },
    headerStamp: { sec: 101, nsec: 125_000_000 },
  });
  expect(event).toEqual(original);
});

it("reports nonnumeric arrays rather than assigning object identities", async () => {
  const builder = new TimestampDatasetsBuilder();
  const config = series();
  builder.setSeries([config]);
  builder.handleMessageRange(
    [message(0, [0, 0, { id: 2 }, { id: 3 }])],
    { isReset: true },
    startTime,
  );
  const result = await builder.getViewportDatasets(viewport);
  expect(result.arrayDatasets).toEqual([]);
  expect(result.pathsWithInvalidArrays).toEqual(new Set([config.messagePath]));
});

it.each([
  "receiveTime",
  "headerStamp",
] as const)("combines indexed arrays, Step and right-axis routing without changing %s CSV or gaps", async (timestampMethod) => {
  const builder = new TimestampDatasetsBuilder();
  const config = series("/sample.values[2:3]", {
    configIndex: 1,
    timestampMethod,
    lineInterpolation: "step",
    yAxisID: "yRight",
  });
  const scalar = series("/sample.scalar", { configIndex: 2, expandArrays: false });
  const events = [
    message(0, [0, 0, 1100, 2100], 10),
    message(1, [0, 0, 1400, 2400], 11),
    message(1, [0, 0, 1450, 2450], 11),
    message(2, [], 12),
    message(3, [0, 0, 1300, 2300], 13),
    message(4, [0, 0, 1900, 2900], 14),
  ];
  const originalEvents = structuredClone(events);
  builder.setSeries([config, scalar]);
  builder.handleMessageRange(events, { isReset: true }, startTime);
  const initial = await builder.getViewportDatasets(viewport);
  const csv = structuredClone(await builder.getCsvData());
  expect(initial.arrayDatasets?.map((item) => [item.configIndex, item.arrayIndex])).toEqual([
    [1, 2],
    [1, 3],
  ]);
  expect(initial.arrayDatasets?.map(({ dataset }) => [dataset.stepped, dataset.yAxisID])).toEqual([
    ["before", "yRight"],
    ["before", "yRight"],
  ]);
  expect(
    initial.arrayDatasets?.map(({ dataset }) => dataset.data.some((item) => Number.isNaN(item.x))),
  ).toEqual([true, true]);
  expect(initial.datasetsByConfigIndex[2]?.yAxisID).toBeUndefined();
  expect(csv.slice(1).map((item) => item.data.length)).toEqual([5, 5]);
  expect(csv[1]!.data.map((item) => item.receiveTime.sec)).toEqual([100, 101, 101, 103, 104]);
  expect(csv[1]!.data.map((item) => item.headerStamp?.sec)).toEqual([110, 111, 111, 113, 114]);
  builder.setSeries([{ ...config, lineInterpolation: undefined, yAxisID: undefined }, scalar]);
  const restored = await builder.getViewportDatasets(viewport);
  expect(restored.arrayDatasets?.map(({ dataset }) => [dataset.stepped, dataset.yAxisID])).toEqual([
    [undefined, undefined],
    [undefined, undefined],
  ]);
  expect(restored.arrayDatasets?.map(({ dataset }) => dataset.data)).toEqual(
    initial.arrayDatasets?.map(({ dataset }) => dataset.data),
  );
  expect(await builder.getCsvData()).toEqual(csv);
  expect(events).toEqual(originalEvents);
});

it.each([
  "receiveTime",
  "headerStamp",
] as const)("keeps Step/right-axis array derivatives separate across %s preload/current gaps", async (timestampMethod) => {
  const builder = new TimestampDatasetsBuilder();
  const config = series("/sample.values[2:2].@derivative", {
    timestampMethod,
    lineInterpolation: "step",
    yAxisID: "yRight",
  });
  builder.setSeries([config]);
  builder.handlePlayerState(
    PlayerBuilder.playerState({
      activeData: PlayerBuilder.activeData({
        startTime,
        endTime: { sec: 117, nsec: 0 },
        messages: [message(6, [0, 0, 2000], 16), message(7, [0, 0, 2300], 17)],
      }),
    }),
  );
  builder.handleMessageRange(
    [
      message(0, [0, 0, 1100], 10),
      message(1, [0, 0, 1400], 11),
      message(2, [0, 0, 1800], 12),
      message(3, [], 13),
      message(4, [0, 0, 1300], 14),
      message(5, [0, 0, 1900], 15),
    ],
    { isReset: true },
    startTime,
  );
  const result = await builder.getViewportDatasets(viewport);
  const offset = timestampMethod === "receiveTime" ? 0 : 10;
  expect(points(result.arrayDatasets![0]!.dataset.data)).toEqual([
    [offset + 1, 300],
    [offset + 2, 400],
    [offset + 5, 600],
    [offset + 7, 300],
  ]);
  expect(result.arrayDatasets![0]!.dataset).toMatchObject({
    stepped: "before",
    yAxisID: "yRight",
  });
  const csv = structuredClone(await builder.getCsvData());
  expect(csv[0]!.data.map(({ y }) => y)).toEqual([1100, 1400, 1800, 1300, 1900, 2000, 2300]);
  expect(result.arrayDatasets![0]!.dataset.data.filter(({ x }) => Number.isNaN(x))).toHaveLength(2);
  expect((await builder.getViewportDatasets(viewport)).arrayDatasets).toEqual(result.arrayDatasets);
  expect(await builder.getCsvData()).toEqual(csv);
});

it("samples right-axis array children in their own pixel domain", async () => {
  const builder = new TimestampDatasetsBuilder();
  const config = series("/sample.values[2:2]", {
    showLine: false,
    yAxisID: "yRight",
    lineInterpolation: "step",
  });
  builder.setSeries([config]);
  builder.handleMessageRange(
    [message(0, [0, 0, 1100]), message(1, [0, 0, 1400]), message(2, [0, 0, 1800])],
    { isReset: true },
    startTime,
  );
  const result = await builder.getViewportDatasets({
    size: { width: 1, height: 400 },
    bounds: { y: { min: 0, max: 1e9 }, yRight: { min: 1000, max: 2000 } },
  });
  expect(points(result.arrayDatasets![0]!.dataset.data)).toEqual([
    [0, 1100],
    [1, 1400],
    [2, 1800],
  ]);
  expect(result.arrayDatasets![0]!.dataset.yAxisID).toBe("yRight");
});
