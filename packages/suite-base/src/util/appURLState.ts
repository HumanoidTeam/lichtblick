// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { Time, compare, toRFC3339String } from "@lichtblick/rostime";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { parseTimeUrlString } from "@lichtblick/suite-base/util/time";

import { keyMap } from "./constants";

export type AppURLState = {
  ds?: string;
  layoutUrl?: string;
  dsParams?: Record<string, string>;
  dsParamsArray?: Record<string, string[]>;
  layoutId?: LayoutID;
  mcapBundleId?: string;
  time?: Time;
  startTime?: Time;
  endTime?: Time;
};

/**
 * Encodes app state in a URL's query params.
 *
 * @param url The base URL to encode params into.
 * @param urlState The player state to encode.
 * @returns A url with all app state stored as query pararms.
 */
export function updateAppURLState(url: URL, urlState: AppURLState): URL {
  const newURL = new URL(url.href);

  if ("time" in urlState) {
    if (urlState.time) {
      newURL.searchParams.set("time", toRFC3339String(urlState.time));
    } else {
      newURL.searchParams.delete("time");
    }
  }

  if ("startTime" in urlState) {
    if (urlState.startTime) {
      newURL.searchParams.set("startTime", toRFC3339String(urlState.startTime));
    } else {
      newURL.searchParams.delete("startTime");
    }
  }

  if ("endTime" in urlState) {
    if (urlState.endTime) {
      newURL.searchParams.set("endTime", toRFC3339String(urlState.endTime));
    } else {
      newURL.searchParams.delete("endTime");
    }
  }

  if ("ds" in urlState) {
    if (urlState.ds) {
      newURL.searchParams.set("ds", urlState.ds);
    } else {
      newURL.searchParams.delete("ds");
    }
  }

  if ("layoutUrl" in urlState) {
    if (urlState.layoutUrl) {
      newURL.searchParams.set("layoutUrl", urlState.layoutUrl);
    } else {
      newURL.searchParams.delete("layoutUrl");
    }
  }

  if (urlState.dsParams || urlState.dsParamsArray) {
    [...newURL.searchParams].forEach(([k]) => {
      if (k.startsWith("ds.")) {
        newURL.searchParams.delete(k);
      }
    });

    Object.entries(urlState.dsParams ?? {}).forEach(([k, v]) => {
      newURL.searchParams.append("ds." + (keyMap[k] ?? k), v);
    });
    Object.entries(urlState.dsParamsArray ?? {}).forEach(([k, v]) => {
      v.forEach((item: string) => {
        newURL.searchParams.append("ds." + (keyMap[k] ?? k), item);
      });
    });
  }

  newURL.searchParams.sort();

  return newURL;
}

/**
 * Tries to parse a state url into one of the types we know how to open.
 *
 * @param url URL to try to parse.
 * @returns Parsed URL type or undefined if the url is not a valid URL.
 * @throws Error if URL parsing fails.
 */
export function parseAppURLState(url: URL): AppURLState | undefined {
  const ds = url.searchParams.get("ds") ?? undefined;
  const layoutUrl = url.searchParams.get("layoutUrl");
  const mcapBundleId = url.searchParams.get("mcap-bundle") ?? undefined;
  const timeString = url.searchParams.get("time");
  const time = parseTimeUrlString(timeString ?? undefined);
  const startTime = parsePlaybackBound(url, "startTime");
  const endTime = parsePlaybackBound(url, "endTime");

  if (startTime && endTime && compare(startTime, endTime) > 0) {
    throw new Error("Invalid playback range: startTime must be before or equal to endTime");
  }
  const dsParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k && v && k.startsWith("ds.")) {
      const cleanKey = k.replace(/^ds./, "");
      if (dsParams[cleanKey] == undefined) {
        dsParams[cleanKey] = v;
      } else if (cleanKey === "url") {
        dsParams[cleanKey] = dsParams[cleanKey] + "," + v;
      } else {
        dsParams[cleanKey] = v;
      }
    }
  });

  const state: AppURLState = _.omitBy(
    {
      time,
      startTime,
      endTime,
      ds,
      layoutUrl,
      mcapBundleId,
      dsParams: _.isEmpty(dsParams) ? undefined : dsParams,
    },
    _.isEmpty,
  );

  return _.isEmpty(state) ? undefined : state;
}

function parsePlaybackBound(url: URL, parameterName: "startTime" | "endTime"): Time | undefined {
  if (!url.searchParams.has(parameterName)) {
    return undefined;
  }

  const value = url.searchParams.get(parameterName);
  const parsed = parseTimeUrlString(value ?? undefined);
  if (!parsed) {
    throw new Error(`Invalid ${parameterName} URL parameter`);
  }
  return parsed;
}

/**
 * Tries to parse app url state from the window's current location.
 */
export function windowAppURLState(): AppURLState | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return parseAppURLState(new URL(window.location.href));
  } catch {
    return undefined;
  }
}
