/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";
import * as _ from "lodash-es";

import { parseMessagePath } from "@lichtblick/message-path";
import {
  getMessagePathDataItems,
  MessageAndData,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { Downsampler } from "@lichtblick/suite-base/components/TimeBasedChart/Downsampler";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";

import { ROW_SPACING } from "./hooks/constants";
import useStateTransitionsData from "./hooks/useStateTransitionsData";
import { StateTransitionPath } from "./types";

const START = { sec: 100, nsec: 0 };
const TOPIC = "/states";
const ARRAY_PATH = `${TOPIC}.values[:]`;
const expanded: StateTransitionPath & { expandArrays: boolean } = {
  value: ARRAY_PATH,
  timestampMethod: "receiveTime",
  expandArrays: true,
};
function message(offset: number, values: unknown[], valuePath = ARRAY_PATH): MessageAndData {
  const event = MessageEventBuilder.messageEvent({
    topic: TOPIC,
    receiveTime: { sec: START.sec + offset, nsec: 0 },
    message: { values },
  });
  return {
    messageEvent: event,
    queriedData:
      getMessagePathDataItems(
        event,
        parseMessagePath(valuePath)!,
        { [TOPIC]: { name: TOPIC, schemaName: undefined } },
        {},
        {},
      ) ?? [],
  };
}
function convert(messages: MessageAndData[], path: StateTransitionPath = expanded) {
  return renderHook(() =>
    useStateTransitionsData([path], START, {}, [{ [path.value]: messages }], true),
  ).result.current;
}

describe("State Transitions expanded primitive arrays", () => {
  it("uses resolved slice indices rather than compacted result positions", () => {
    const path = { ...expanded, value: `${TOPIC}.values[2:12]`, label: "Modes" };
    const messages = [
      message(0, [0, 0, true, undefined, false], path.value),
      message(
        1,
        Array.from({ length: 13 }, (_value, i) => i),
        path.value,
      ),
    ];
    const result = convert(messages, path);
    expect(result.legendRows.map((row) => row.path.value)).toEqual(
      Array.from({ length: 11 }, (_value, i) => `${TOPIC}.values[${i + 2}]`),
    );
    expect(result.legendRows[0]?.path.label).toBe("Modes [2]");
    expect(result.legendRows.every((row) => row.configIndex === 0)).toBe(true);
    expect(result.data.datasets[0]?.data.map((point) => point?.value)).toEqual([true, 2]);
    expect(result.data.datasets[0]?.data.map((point) => point?.x)).toEqual([0, 1]);
    expect(result.data.datasets[0]?.data.every((point) => point?.y === -ROW_SPACING)).toBe(true);
  });

  it("does not bridge shrinking, empty, missing or invalid array values", () => {
    const result = convert([
      message(0, [true, false]),
      message(1, [true, false]),
      message(2, [true]),
      message(3, []),
      message(4, [true, NaN]),
      message(5, [true, false]),
      message(6, [true, false]),
    ]);
    const secondRow = result.data.datasets.filter(
      (dataset) => dataset.label === `${TOPIC}.values[1]`,
    );
    expect(secondRow.map((dataset) => dataset.data.map((point) => point?.x))).toEqual([
      [0, 1],
      [5, 6],
    ]);
    const firstRow = result.data.datasets.filter(
      (dataset) => dataset.label === `${TOPIC}.values[0]`,
    );
    expect(firstRow.map((dataset) => dataset.data.map((point) => point?.x))).toEqual([
      [0, 1, 2],
      [4, 5, 6],
    ]);
  });

  it("preserves segment hover bounds through viewport downsampling", () => {
    const result = convert([
      message(0, [true]),
      message(1, [true]),
      message(2, []),
      message(5, [false]),
      message(6, [false]),
    ]);
    const downsampler = new Downsampler();
    downsampler.update({
      datasets: result.data.datasets,
      datasetBounds: {
        width: 800,
        height: 200,
        bounds: { x: { min: 0, max: 6 }, y: { min: -20, max: 0 } },
      },
      scales: {
        x: { min: 0, max: 6, pixelMin: 0, pixelMax: 800 },
        y: { min: -20, max: 0, pixelMin: 200, pixelMax: 0 },
      },
    });
    expect(downsampler.downsample()?.map((dataset) => dataset.stateTransitionEnd)).toEqual([1, 6]);
  });

  it("keeps unloaded blocks and current-frame data disconnected", () => {
    const { result } = renderHook(() =>
      useStateTransitionsData(
        [expanded],
        START,
        { [ARRAY_PATH]: [message(4, [1])] },
        [{ [ARRAY_PATH]: [message(0, [1])] }, {}, { [ARRAY_PATH]: [message(2, [1])] }],
        true,
      ),
    );
    expect(
      result.current.data.datasets.map((dataset) => dataset.data.map((point) => point?.x)),
    ).toEqual([[0], [2], [4]]);
  });

  it("preserves relative negative selectors and numeric row ordering", () => {
    const path = { ...expanded, value: `${TOPIC}.values[-3:-1]` };
    const result = convert([message(0, [1, 2, 3, 4], path.value)], path);
    expect(result.legendRows.map((row) => row.path.value)).toEqual(
      [-3, -2, -1].map((i) => `${TOPIC}.values[${i}]`),
    );
    expect(result.data.datasets.map((dataset) => dataset.data[0]?.value)).toEqual([2, 3, 4]);
  });

  it("keeps scalar and unexpanded array behavior unchanged", () => {
    const result = convert([message(0, [1, 2])], { ...expanded, expandArrays: false });
    expect(result.data.datasets).toHaveLength(1);
    expect(result.data.datasets[0]?.data).toEqual([]);
    expect(result.legendRows).toEqual([
      { path: { ...expanded, expandArrays: false }, configIndex: 0 },
    ]);
  });

  it("preserves primitive values, constants, duplicate timestamps and input identity", () => {
    const first = message(0, [false, "Idle", BigInt(42)]);
    first.queriedData[0]!.constantName = "STOPPED";
    const original = _.cloneDeep(first);
    const result = convert([first, message(0, [true, "Run", BigInt(43)])]);
    expect(
      result.data.datasets.map((dataset) => dataset.data.map((point) => point?.value)),
    ).toEqual([
      [false, true],
      ["Idle", "Run"],
      [BigInt(42), BigInt(43)],
    ]);
    expect(result.data.datasets[0]?.data[0]?.label).toBe("STOPPED (false)");
    expect(first).toEqual(original);
  });

  it("honors the chosen header clock and breaks at missing headers", () => {
    const messages = [message(0, [1]), message(1, [1]), message(2, [1])];
    messages[0]!.messageEvent.message = {
      values: [1],
      header: { stamp: { sec: START.sec + 10, nsec: 125_000_000 } },
    };
    messages[2]!.messageEvent.message = {
      values: [1],
      header: { stamp: { sec: START.sec + 20, nsec: 250_000_000 } },
    };
    const result = convert(messages, { ...expanded, timestampMethod: "headerStamp" });
    expect(result.data.datasets.map((dataset) => dataset.data.map((point) => point?.x))).toEqual([
      [10.125],
      [20.25],
    ]);
  });

  it.each([
    `${TOPIC}.values`,
    `${TOPIC}.values[:].state`,
    `${TOPIC}.nested[:].values[:]`,
  ])("reports unsupported array selector %s without guessing identities", (value) => {
    const result = convert([], { ...expanded, value });
    expect(result.pathState[0]?.arrayError).toBe(true);
    expect(result.data.datasets).toEqual([]);
    expect(result.legendRows).toHaveLength(1);
  });

  it("reports object arrays instead of grouping values by their nice ids", () => {
    const result = convert([message(0, [{ id: 1 }, { id: 1 }])]);
    expect(result.pathState[0]?.arrayError).toBe(true);
    expect(result.data.datasets).toEqual([]);
  });

  it("retains one editable row when disabled or not yet observed", () => {
    const path = { ...expanded, enabled: false };
    const result = convert([message(0, [1, 2])], path);
    expect(result.data.datasets).toEqual([]);
    expect(result.legendRows).toEqual([{ path, configIndex: 0 }]);
    expect(convert([]).legendRows).toEqual([{ path: expanded, configIndex: 0 }]);
  });

  it("maps following scalar rows to their original config index", () => {
    const scalar = { value: `${TOPIC}.scalar`, timestampMethod: "receiveTime" as const };
    const { result } = renderHook(() =>
      useStateTransitionsData(
        [expanded, scalar],
        START,
        {},
        [{ [ARRAY_PATH]: [message(0, [1, 2])] }],
        false,
      ),
    );
    expect(result.current.legendRows.map((row) => row.configIndex)).toEqual([0, 0, 1]);
    expect(result.current.data.datasets.at(-1)?.label).toBe(scalar.value);
  });
});
