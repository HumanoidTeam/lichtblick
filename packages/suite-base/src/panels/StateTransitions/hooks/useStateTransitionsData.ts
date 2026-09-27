// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useMemo } from "react";

import { Time } from "@lichtblick/rostime";
import { MessageDataItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import {
  ROW_MARGIN,
  ROW_SPACING,
} from "@lichtblick/suite-base/panels/StateTransitions/hooks/constants";
import { UseStateTransitionsData } from "@lichtblick/suite-base/panels/StateTransitions/hooks/types";
import { messagesToDataset } from "@lichtblick/suite-base/panels/StateTransitions/messagesToDataset";
import { datasetContainsArray } from "@lichtblick/suite-base/panels/StateTransitions/shared";
import {
  PathLegendRow,
  PathState,
  StateTransitionPath,
} from "@lichtblick/suite-base/panels/StateTransitions/types";

import { arrayMessagesToDatasets } from "../arrayMessagesToDatasets";

function useStateTransitionsData(
  paths: StateTransitionPath[],
  startTime: Readonly<Time> | undefined,
  itemsByPath: MessageDataItemsByPath,
  decodedBlocks: MessageDataItemsByPath[],
  // eslint-disable-next-line @lichtblick/no-boolean-parameters
  showPoints: boolean,
): UseStateTransitionsData {
  return useMemo(() => {
    // ignore all data when we don't have a start time
    if (!startTime) {
      return {
        data: { datasets: [] },
        minY: undefined,
        pathState: [],
        legendRows: paths.map((path, configIndex) => ({ path, configIndex })),
      };
    }

    let outMinY: number | undefined;
    const outDatasets: ChartDatasets = [];
    const outPathState: PathState[] = [];
    const legendRows: PathLegendRow[] = [];

    paths.forEach((path, pathIndex) => {
      const y = -(legendRows.length + 1) * ROW_SPACING;
      outMinY = Math.min(outMinY ?? y, y - ROW_MARGIN);

      const blocksForPath = decodedBlocks.map((decodedBlock) => decodedBlock[path.value]);
      if (path.expandArrays === true) {
        const expanded = arrayMessagesToDatasets({
          blocks: [...blocksForPath, undefined, itemsByPath[path.value]],
          path,
          pathIndex,
          startTime,
          y,
          showPoints,
        });
        outPathState.push({ path, isArray: false, arrayError: expanded.error });
        for (const row of expanded.rows) {
          legendRows.push({ path: row.path, configIndex: pathIndex });
          outDatasets.push(...row.datasets);
        }
        if (expanded.rows.length === 0) {
          legendRows.push({ path, configIndex: pathIndex });
        }
        outMinY = -legendRows.length * ROW_SPACING - ROW_MARGIN;
        return;
      }
      legendRows.push({ path, configIndex: pathIndex });

      const newBlockDataSet = messagesToDataset({
        blocks: blocksForPath,
        path,
        pathIndex,
        startTime,
        y,
        showPoints,
      });

      const items = itemsByPath[path.value];
      const isArray = datasetContainsArray([...blocksForPath, items]);

      outPathState.push({
        path,
        isArray,
      });
      outDatasets.push(newBlockDataSet);

      if (items == undefined) {
        return;
      }

      const newPathDataSet = messagesToDataset({
        blocks: [items],
        path,
        pathIndex,
        startTime,
        y,
        showPoints,
      });
      outDatasets.push(newPathDataSet);
    });

    return {
      data: { datasets: outDatasets },
      minY: outMinY,
      pathState: outPathState,
      legendRows,
    };
  }, [decodedBlocks, itemsByPath, paths, startTime, showPoints]);
}

export default useStateTransitionsData;
