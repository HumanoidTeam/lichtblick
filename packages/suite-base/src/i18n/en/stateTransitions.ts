// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const stateTransitions = {
  addSeriesButton: "Click to add a series",
  arrayPathError:
    "Use a single primitive-array slice, such as .states[:], without object arrays or filters.",
  labels: {
    addSeries: "Add series",
    axisLabel: "Axis label",
    deleteSeries: "Delete series",
    deleteArraySeries: "Delete array series (all rows)",
    expandArrays: "Array rows",
    expandArraysHelp:
      "One row per observed source index in a primitive-array slice (for example .states[:]). Missing values leave gaps. Negative indices stay relative to the array end. Rows share the series settings.",
    general: "General",
    helpGeneral: "Display a point for every state transition message",
    label: "Label",
    messagePath: "Message path",
    series: "Series",
    showPoints: "Show points",
    sync: "Sync with other plots",
    timestamp: "Timestamp",
    timestampHeaderStamp: "Header Stamp",
    timestampReceiveTime: "Receive Time",
  },
  max: "Max",
  maxXError: "X max must be greater than X min.",
  min: "Min",
  pathErrorMessage: "This path resolves to more than one value",
  secondsRange: "Range (seconds)",
  xAxis: "X Axis",
};
