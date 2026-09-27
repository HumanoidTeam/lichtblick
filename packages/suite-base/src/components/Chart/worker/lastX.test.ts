/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Chart, Interaction, PointElement } from "chart.js";

import "./ChartJSManager";

describe("lastX segmented state hover", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    { cursor: 0.5, expected: [0, 2] },
    { cursor: 1, expected: [0, 2] },
    { cursor: 3, expected: [2] },
    { cursor: 5.5, expected: [1, 2] },
    { cursor: 100, expected: [2] },
  ])("does not report expired segments at x=$cursor", ({ cursor, expected }) => {
    const values = [
      [0, 1],
      [5, 6],
      [0, 7],
    ];
    const chart = {
      data: { datasets: [{ stateTransitionEnd: 1 }, { stateTransitionEnd: 6 }, {}] },
      getDatasetMeta: () => ({ xScale: { getValueForPixel: (x: number) => x } }),
    } as unknown as Chart;
    jest
      .spyOn(Interaction, "evaluateInteractionItems")
      .mockImplementation((_chart, _axis, _position, handler) => {
        for (const [datasetIndex, series] of values.entries()) {
          for (const [index, x] of series.entries()) {
            handler(new PointElement({ x, y: 0 }), datasetIndex, index);
          }
        }
        return [];
      });
    const result = Interaction.modes.lastX(
      chart,
      { type: "mousemove", native: null, x: cursor, y: 0 },
      {},
      false,
    );
    expect(result.map((item) => item.datasetIndex)).toEqual(expected);
  });
});
