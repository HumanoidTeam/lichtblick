// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { parseMessagePath } from "@lichtblick/message-path";
import { MessageAndData } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { getTimestampForMessageEvent } from "@lichtblick/suite-base/util/time";

import { ROW_SPACING } from "./hooks/constants";
import { isValidValue, messagesToDataset } from "./messagesToDataset";
import { MessageDatasetArgs, StateTransitionPath } from "./types";

type ArrayRow = { path: StateTransitionPath; datasets: ChartDatasets };

/** Expand a single primitive-array slice, retaining the decoder's source indices. */
export function arrayMessagesToDatasets(args: MessageDatasetArgs): {
  rows: ArrayRow[];
  error: boolean;
} {
  const parts = parseMessagePath(args.path.value)?.messagePath;
  if (parts?.at(-1)?.type !== "slice" || parts.slice(0, -1).some((part) => part.type !== "name")) {
    return { rows: [], error: true };
  }
  if (args.path.enabled === false) {
    return { rows: [], error: false };
  }

  const rows = new Map<
    string,
    { index: number; segments: MessageAndData[][]; lastOrdinal?: number }
  >();
  let ordinal = 0;
  for (const block of args.blocks) {
    if (block == undefined) {
      // Unknown preload regions and the preload/current boundary cannot join state segments.
      ordinal++;
      continue;
    }
    for (const message of block) {
      ordinal++;
      if (!getTimestampForMessageEvent(message.messageEvent, args.path.timestampMethod)) {
        continue;
      }
      for (const item of message.queriedData) {
        if (
          item.value != undefined &&
          typeof item.value !== "number" &&
          !isValidValue(item.value)
        ) {
          // Object/nested arrays may have non-unique nice-id paths. Do not guess their identity.
          return { rows: [], error: true };
        }
        let row = rows.get(item.path);
        if (!row) {
          const resolved = parseMessagePath(item.path)?.messagePath.at(-1);
          if (
            resolved?.type !== "slice" ||
            typeof resolved.start !== "number" ||
            resolved.start !== resolved.end
          ) {
            return { rows: [], error: true };
          }
          row = { index: resolved.start, segments: [] };
          rows.set(item.path, row);
        }
        if (!isValidValue(item.value)) {
          continue;
        }
        if (row.lastOrdinal !== ordinal - 1) {
          row.segments.push([]);
        }
        row.segments.at(-1)!.push({ messageEvent: message.messageEvent, queriedData: [item] });
        row.lastOrdinal = ordinal;
      }
    }
  }

  return {
    error: false,
    rows: [...rows]
      .sort(([, left], [, right]) => left.index - right.index)
      .map(([value, row], rowIndex) => {
        const path = {
          ...args.path,
          value,
          label: args.path.label ? `${args.path.label} [${row.index}]` : undefined,
        };
        return {
          path,
          // Separate datasets preserve gaps through the existing state downsampler too.
          // End each segment at its last observed sample; never extrapolate through absence.
          datasets: row.segments.map((segment) => {
            const dataset = messagesToDataset({
              ...args,
              path,
              y: args.y - rowIndex * ROW_SPACING,
              blocks: [segment],
            });
            dataset.stateTransitionEnd = dataset.data.reduce(
              (end, point) => Math.max(end, point?.x ?? -Infinity),
              -Infinity,
            );
            return dataset;
          }),
        };
      }),
  };
}
