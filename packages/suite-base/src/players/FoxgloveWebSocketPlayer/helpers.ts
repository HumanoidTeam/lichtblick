// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StatusLevel } from "@foxglove/ws-protocol";

import { PlayerAlert } from "@lichtblick/suite-base/players/types";

import { MAX_LISTED_DEPRECATED_SERVICES } from "./constants";

export function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/msg/${parts[1]}`;
  }
  return dataType;
}

export function statusLevelToAlertSeverity(level: StatusLevel): PlayerAlert["severity"] {
  if (level === StatusLevel.INFO) {
    return "info";
  } else if (level === StatusLevel.WARNING) {
    return "warn";
  } else {
    return "error";
  }
}

/**
 * Builds one alert covering every service that still advertises the deprecated `requestSchema` /
 * `responseSchema` fields, or `undefined` when there are none.
 *
 * Aggregated rather than raised per service because a bridge predating the migration advertises
 * every one of its services this way: on a robot that is hundreds of identical alerts, which buries
 * every other alert and is the first thing an operator sees.
 */
export function buildDeprecatedServiceSchemaAlert(
  serviceNames: readonly string[],
): PlayerAlert | undefined {
  if (serviceNames.length === 0) {
    return undefined;
  }

  const sorted = [...serviceNames].sort();
  const shown = sorted.slice(0, MAX_LISTED_DEPRECATED_SERVICES);
  const remaining = sorted.length - shown.length;
  const serviceList =
    remaining > 0 ? `${shown.join(", ")} and ${remaining} more` : shown.join(", ");
  const plural = sorted.length !== 1;

  return {
    severity: "warn",
    message: `${sorted.length} service${plural ? "s" : ""} use${plural ? "" : "s"} deprecated schema fields`,
    error: new Error(
      `requestSchema and responseSchema are deprecated and will not be supported in future versions of Lichtblick. Affected services: ${serviceList}`,
    ),
  };
}
