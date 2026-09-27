// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { ComlinkWrap } from "@lichtblick/den/worker";
import { MessagePath } from "@lichtblick/message-path";
import { toSec, subtract as subtractTime } from "@lichtblick/rostime";
import { Immutable, MessageEvent, Time } from "@lichtblick/suite";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { PlayerState } from "@lichtblick/suite-base/players/types";
import { TimestampMethod, getTimestampForMessage } from "@lichtblick/suite-base/util/time";

import {
  ArrayDataset,
  CsvDataset,
  GetViewportDatasetsResult,
  HandlePlayerStateResult,
  IDatasetsBuilder,
  SeriesConfigKey,
  SeriesItem,
  Viewport,
} from "./IDatasetsBuilder";
import type {
  DataItem,
  TimestampDatasetsBuilderImpl,
  UpdateDataAction,
} from "./TimestampDatasetsBuilderImpl";
import {
  makeArraySeries,
  readArrayValues,
  supportsArraySeries,
  TimestampSeriesConfig,
} from "./arraySeries";
import { buildCurrentSeriesActions, buildFullSeriesActions } from "./utils";
import { MATH_FUNCTIONS } from "../constants";
import { resolveChartDatum } from "../utils/datum";
import { MathFunction } from "../utils/mathFunctions";

// If the datasets builder is garbage collected we also need to cleanup the worker
// This registry ensures the worker is cleaned up when the builder is garbage collected
const registry = new FinalizationRegistry<() => void>((dispose) => {
  dispose();
});

const emptyPaths = new Set<string>();

type TimestampSeriesItem = {
  config: Immutable<TimestampSeriesConfig>;
};

/**
 * TimestampDatasetsBuilder builds timeseries datasets.
 *
 * It supports full (preload) data and current frame data. The series datums are extracted from
 * input player states and sent to the worker. The worker accumulates the data and provides
 * downsampled data.
 */
export class TimestampDatasetsBuilder implements IDatasetsBuilder {
  #datasetsBuilderRemote: Comlink.Remote<Comlink.RemoteObject<TimestampDatasetsBuilderImpl>>;

  #pendingDispatch: Immutable<UpdateDataAction>[] = [];

  #lastSeekTime = 0;

  #series: Immutable<TimestampSeriesItem[]> = [];
  #savedSeries: Immutable<SeriesItem[]> = [];
  #arrayIndices = new Map<SeriesConfigKey, Set<number>>();
  #invalidArrays = new Set<string>();
  // True once handleMessageRange has been called — indicates a range-capable source (file/bag).
  // When true, handlePlayerState skips append-current since the full history comes from the range.
  #hasRangeSource = false;

  public constructor() {
    const worker = new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL("./TimestampDatasetsBuilderImpl.worker", import.meta.url),
    );
    const { remote, dispose } =
      ComlinkWrap<Comlink.RemoteObject<TimestampDatasetsBuilderImpl>>(worker);
    this.#datasetsBuilderRemote = remote;

    registry.register(this, dispose);
  }

  public handlePlayerState(state: Immutable<PlayerState>): HandlePlayerStateResult | undefined {
    const activeData = state.activeData;
    if (!activeData) {
      return;
    }

    const didSeek = activeData.lastSeekTime !== this.#lastSeekTime;
    this.#lastSeekTime = activeData.lastSeekTime;

    const msgEvents = activeData.messages;
    let datasetsChanged = false;
    if (!this.#hasRangeSource && msgEvents.length > 0) {
      this.#discoverArrays(msgEvents);
      const { actions: seriesActions, datasetsChanged: seriesChanged } = buildCurrentSeriesActions(
        this.#series,
        { didSeek, hasRangeSource: this.#hasRangeSource },
        (config) => {
          const mathFn = config.parsed.modifier
            ? MATH_FUNCTIONS[config.parsed.modifier]
            : undefined;
          return readMessagePathItems(
            msgEvents,
            config.parsed,
            config.timestampMethod,
            activeData.startTime,
            mathFn,
            { breakOnMissing: config.expandArrays === true },
          );
        },
      );
      this.#pendingDispatch.push(...(seriesActions as UpdateDataAction[]));
      datasetsChanged ||= seriesChanged;
    }

    return {
      range: { min: 0, max: toSec(subtractTime(activeData.endTime, activeData.startTime)) },
      datasetsChanged,
    };
  }

  public handleMessageRange(
    messages: Immutable<MessageEvent[]>,
    options: { isReset: boolean },
    startTime: Immutable<Time>,
  ): void {
    this.#hasRangeSource = true;
    const topic = messages[0]?.topic;
    if (!topic) {
      return;
    }

    this.#discoverArrays(messages);
    const actions = buildFullSeriesActions(this.#series, topic, options, (config) => {
      const mathFn = config.parsed.modifier ? MATH_FUNCTIONS[config.parsed.modifier] : undefined;
      return readMessagePathItems(
        messages,
        config.parsed,
        config.timestampMethod,
        startTime,
        mathFn,
        { breakOnMissing: config.expandArrays === true },
      );
    });
    this.#pendingDispatch.push(...(actions as UpdateDataAction[]));
  }

  public setSeries(series: Immutable<SeriesItem[]>): void {
    this.#savedSeries = series;
    this.#arrayIndices = new Map(
      series
        .filter((item) => item.expandArrays === true)
        .map((item) => [item.key, this.#arrayIndices.get(item.key) ?? new Set<number>()]),
    );
    this.#invalidArrays = new Set(
      series
        .filter((item) => item.expandArrays === true && !supportsArraySeries(item.parsed))
        .map((item) => item.messagePath),
    );
    this.#rebuildSeries();
  }

  #discoverArrays(events: Immutable<MessageEvent[]>): void {
    let changed = false;
    for (const config of this.#savedSeries) {
      const indices = this.#arrayIndices.get(config.key);
      if (!indices) {
        continue;
      }
      for (const event of events) {
        if (event.topic !== config.parsed.topicName) {
          continue;
        }
        const observed = readArrayValues(event, config.parsed);
        if (!observed) {
          this.#invalidArrays.add(config.messagePath);
          continue;
        }
        for (const index of observed.keys()) {
          if (!indices.has(index)) {
            indices.add(index);
            changed = true;
          }
        }
      }
    }
    if (changed) {
      this.#rebuildSeries();
    }
  }

  #rebuildSeries(): void {
    const series: Immutable<TimestampSeriesConfig>[] = this.#savedSeries.filter(
      (item) => item.expandArrays !== true,
    );
    let slot = this.#savedSeries.reduce((max, item) => Math.max(max, item.configIndex + 1), 0);
    for (const config of this.#savedSeries) {
      for (const index of [...(this.#arrayIndices.get(config.key) ?? [])].sort((a, b) => a - b)) {
        series.push(makeArraySeries(config, index, slot++));
      }
    }
    this.#series = series.map((config) => ({ config }));
    this.#pendingDispatch.push({ type: "update-series-config", seriesItems: series });
  }

  public async getViewportDatasets(
    viewport: Immutable<Viewport>,
  ): Promise<GetViewportDatasetsResult> {
    // Capture the mapping before awaiting the worker; new batches may discover more children.
    const series = this.#series;
    const hasArrays = this.#arrayIndices.size > 0;
    const invalidArrays = new Set(this.#invalidArrays);
    await this.#flush();
    const datasets = await this.#datasetsBuilderRemote.getViewportDatasets(viewport);
    if (!hasArrays) {
      return { datasetsByConfigIndex: datasets, pathsWithMismatchedDataLengths: emptyPaths };
    }
    const datasetsByConfigIndex: GetViewportDatasetsResult["datasetsByConfigIndex"][number][] = [];
    const arrayDatasets: ArrayDataset[] = [];
    for (const { config } of series) {
      const dataset = datasets[config.configIndex];
      if (config.arrayIndex == undefined || config.sourceConfigIndex == undefined) {
        datasetsByConfigIndex[config.configIndex] = dataset;
      } else {
        arrayDatasets.push({
          configIndex: config.sourceConfigIndex,
          arrayIndex: config.arrayIndex,
          messagePath: config.messagePath,
          color: config.color,
          dataset: dataset ?? { data: [] },
        });
      }
    }
    return {
      datasetsByConfigIndex,
      pathsWithMismatchedDataLengths: emptyPaths,
      arrayDatasets,
      pathsWithInvalidArrays: invalidArrays,
    };
  }

  async #flush(): Promise<void> {
    const dispatch = this.#pendingDispatch;
    this.#pendingDispatch = [];
    if (dispatch.length > 0) {
      await this.#datasetsBuilderRemote.applyActions(dispatch);
    }
  }

  public async getCsvData(): Promise<CsvDataset[]> {
    await this.#flush();
    return await this.#datasetsBuilderRemote.getCsvData();
  }
}

function readMessagePathItems(
  events: Immutable<MessageEvent[]>,
  path: Immutable<MessagePath>,
  timestampMethod: TimestampMethod,
  startTime: Immutable<Time>,
  mathFunction?: MathFunction,
  { breakOnMissing = false }: { breakOnMissing?: boolean } = {},
): DataItem[] {
  const out = [];
  for (const event of events) {
    if (event.topic !== path.topicName) {
      continue;
    }

    const items = simpleGetMessagePathDataItems(event, path);
    const previousLength = out.length;
    for (const item of items) {
      if (breakOnMissing && typeof item !== "number" && typeof item !== "bigint") {
        continue;
      }
      const datum = resolveChartDatum(item, mathFunction);
      if (!datum) {
        continue;
      }

      const headerStamp = getTimestampForMessage(event.message);
      const timestamp = timestampMethod === "receiveTime" ? event.receiveTime : headerStamp;
      if (!timestamp) {
        continue;
      }

      const xValue = toSec(subtractTime(timestamp, startTime));
      if (breakOnMissing && (!Number.isFinite(xValue) || !Number.isFinite(datum.y))) {
        continue;
      }
      out.push({
        x: xValue,
        y: datum.y,
        receiveTime: event.receiveTime,
        headerStamp,
        value: datum.value,
      });
    }
    if (breakOnMissing && out.length === previousLength) {
      out.push({ x: NaN, y: NaN, value: NaN, receiveTime: event.receiveTime });
    }
  }

  return out;
}
