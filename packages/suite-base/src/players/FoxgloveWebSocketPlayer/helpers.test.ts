// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StatusLevel } from "@foxglove/ws-protocol";

import { MAX_LISTED_DEPRECATED_SERVICES } from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/constants";
import {
  buildDeprecatedServiceSchemaAlert,
  dataTypeToFullName,
  statusLevelToAlertSeverity,
} from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/helpers";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("dataTypeToFullName", () => {
  it("should convert dataType to include /msg/ on it", () => {
    const message = "unit/test";

    const result = dataTypeToFullName(message);

    expect(result).toBe("unit/msg/test");
  });

  it("should return the message unaltered if it differs from the 'text/text' format", () => {
    const message = BasicBuilder.string();

    const result = dataTypeToFullName(message);

    expect(result).toBe(message);
  });
});

describe("statusLevelToProblemSeverity", () => {
  type StatusLevelToProblemTest = [level: StatusLevel, result: string];

  it.each<StatusLevelToProblemTest>([
    [StatusLevel.INFO, "info"],
    [StatusLevel.WARNING, "warn"],
    [StatusLevel.ERROR, "error"],
  ])("should map StatusLevel %s to result %s", (level, result) => {
    expect(statusLevelToAlertSeverity(level)).toBe(result);
  });
});

describe("buildDeprecatedServiceSchemaAlert", () => {
  it("returns no alert when no service uses the deprecated fields", () => {
    expect(buildDeprecatedServiceSchemaAlert([])).toBeUndefined();
  });

  it("names the single offending service", () => {
    const alert = buildDeprecatedServiceSchemaAlert(["/set_bool"]);

    expect(alert?.severity).toBe("warn");
    expect(alert?.message).toBe("1 service uses deprecated schema fields");
    expect(alert?.error?.message).toContain("/set_bool");
  });

  it("collapses many offending services into one alert", () => {
    // The case this exists for: foxglove_bridge advertises every ROS service this way, which
    // previously produced one alert per service and buried everything else
    const names = Array.from({ length: 99 }, (_, i) => `/service_${String(i).padStart(2, "0")}`);

    const alert = buildDeprecatedServiceSchemaAlert(names);

    expect(alert?.message).toBe("99 services use deprecated schema fields");
    expect(alert?.error?.message).toContain(`and ${99 - MAX_LISTED_DEPRECATED_SERVICES} more`);
  });

  it("lists every service without a summary when they fit", () => {
    const names = Array.from({ length: MAX_LISTED_DEPRECATED_SERVICES }, (_, i) => `/svc_${i}`);

    const alert = buildDeprecatedServiceSchemaAlert(names);

    expect(alert?.error?.message).not.toContain("more");
    for (const name of names) {
      expect(alert?.error?.message).toContain(name);
    }
  });

  it("sorts names so the same set of services yields a stable message", () => {
    // The alert is rebuilt on every advertise batch; an unstable message would churn player state
    const first = buildDeprecatedServiceSchemaAlert(["/b", "/a", "/c"]);
    const second = buildDeprecatedServiceSchemaAlert(["/c", "/b", "/a"]);

    expect(first?.error?.message).toBe(second?.error?.message);
    expect(first?.error?.message).toContain("/a, /b, /c");
  });
});
