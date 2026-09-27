// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2026 Humanoid

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePath } from "@lichtblick/message-path";
import { Immutable, MessageEvent } from "@lichtblick/suite";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { stringifyMessagePath } from "@lichtblick/suite-base/components/MessagePathSyntax/stringifyRosPath";
import { isTypedArray } from "@lichtblick/suite-base/types/isTypedArray";
import { expandedLineColors, getContrastColor } from "@lichtblick/suite-base/util/plotColors";

import { SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";

/** Worker-local slots are mapped back to original config indices at the builder boundary. */
export type TimestampSeriesConfig = SeriesItem & {
  arrayIndex?: number;
  sourceConfigIndex?: number;
};

export function supportsArraySeries(path: Immutable<MessagePath>): boolean {
  const slice = path.messagePath.at(-1);
  return (
    slice?.type === "slice" &&
    typeof slice.start === "number" &&
    Number.isInteger(slice.start) &&
    slice.start >= 0 &&
    typeof slice.end === "number" &&
    slice.end >= slice.start &&
    (Number.isInteger(slice.end) || slice.end === Infinity) &&
    path.messagePath.slice(0, -1).every((part) => part.type === "name")
  );
}

/** Resolve actual source indices, never the ordinal in a filtered result list. */
export function readArrayValues(
  event: Immutable<MessageEvent>,
  path: Immutable<MessagePath>,
): Map<number, number | bigint | undefined> | undefined {
  if (!supportsArraySeries(path)) {
    return undefined;
  }
  const [value] = simpleGetMessagePathDataItems(event, {
    ...path,
    messagePath: path.messagePath.slice(0, -1),
  });
  if (value == undefined) {
    return new Map();
  }
  if (!Array.isArray(value) && !isTypedArray(value)) {
    return undefined;
  }
  const slice = path.messagePath.at(-1)!;
  if (slice.type !== "slice" || typeof slice.start !== "number" || typeof slice.end !== "number") {
    return undefined;
  }
  const values = new Map<number, number | bigint | undefined>();
  for (let index = slice.start; index < value.length && index <= slice.end; ++index) {
    const item = value[index];
    if (item != undefined && typeof item !== "number" && typeof item !== "bigint") {
      return undefined;
    }
    values.set(
      index,
      typeof item === "bigint" || (typeof item === "number" && Number.isFinite(item))
        ? item
        : undefined,
    );
  }
  return values;
}

export function makeArraySeries(
  config: Immutable<SeriesItem>,
  arrayIndex: number,
  slot: number,
): Immutable<TimestampSeriesConfig> {
  const parsed = {
    ...config.parsed,
    messagePath: [
      ...config.parsed.messagePath.slice(0, -1),
      { type: "slice" as const, start: arrayIndex, end: arrayIndex },
    ],
  };
  const color = config.arrayColor ?? expandedLineColors[arrayIndex % expandedLineColors.length]!;
  return {
    ...config,
    key: `${config.key}:array:${arrayIndex}` as SeriesConfigKey,
    configIndex: slot,
    sourceConfigIndex: config.configIndex,
    arrayIndex,
    parsed,
    messagePath: stringifyMessagePath(parsed),
    color,
    contrastColor: getContrastColor(config.colorScheme ?? "light", color),
  };
}
