// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartOptions } from "chart.js";

import { ChartOptionsPlot } from "@lichtblick/suite-base/panels/Plot/types";
import { fontMonospace } from "@lichtblick/theme";

export const getChartOptions = ({
  devicePixelRatio,
  gridColor,
  tickColor,
}: ChartOptionsPlot): ChartOptions<"scatter"> => ({
  maintainAspectRatio: false,
  animation: false,
  elements: { line: { tension: 0 } },
  interaction: {
    intersect: false,
    mode: "x",
  },
  devicePixelRatio,
  font: {
    family: fontMonospace,
    size: 10,
  },
  responsive: false,
  scales: {
    x: {
      type: "linear",
      display: true,
      grid: {
        color: gridColor,
      },
      ticks: {
        font: {
          family: fontMonospace,
          size: 10,
        },
        color: tickColor,
        maxRotation: 0,
        // Keep the first and last labels inside the chart. With the default alignment chart.js
        // reserves half of the last label's width as right padding, so the chart area changed width
        // when the label at the live edge changed length (for example "6.4" to "6.45").
        align: "inner",
      },
    },
    y: {
      type: "linear",
      display: true,
      grid: {
        color: gridColor,
      },
      ticks: {
        font: {
          family: fontMonospace,
          size: 10,
        },
        color: tickColor,
        padding: 0,
        precision: 3,
      },
    },
    yRight: {
      type: "linear",
      axis: "y",
      position: "right",
      display: false,
      grid: { drawOnChartArea: false, color: gridColor },
      ticks: {
        font: { family: fontMonospace, size: 10 },
        color: tickColor,
        padding: 0,
        precision: 3,
      },
    },
  },
  plugins: {
    decimation: {
      enabled: false,
    },
    tooltip: {
      enabled: false,
    },
    zoom: {
      zoom: {
        enabled: true,
        mode: "x",
        sensitivity: 3,
        speed: 0.1,
      },
      pan: {
        mode: "xy",
        enabled: true,
        speed: 20,
        threshold: 10,
      },
    },
  },
});
