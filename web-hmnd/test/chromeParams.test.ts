// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { resolveChromeParams } from "../src/chromeParams";

function resolve(query: string) {
  return resolveChromeParams(new URLSearchParams(query));
}

describe("resolveChromeParams", () => {
  it("defaults to full authoring mode when no parameters are given", () => {
    expect(resolve("")).toEqual({
      showAppBar: true,
      panelToolbarMode: "full",
      layoutLocked: false,
      collapseSidebars: false,
    });
  });

  it("hides the app bar for an explicit 1", () => {
    expect(resolve("hmnd-hide-appbar=1").showAppBar).toBe(false);

    // Anything else keeps the stock, visible app bar
    for (const query of ["hmnd-hide-appbar=0", "hmnd-hide-appbar", "hmnd-hide-appbar=true"]) {
      expect(resolve(query).showAppBar).toBe(true);
    }
    // The removed old parameter has no effect
    expect(resolve("hmnd-appbar=1").showAppBar).toBe(true);
  });

  it("sets the toolbar mode from the parameter value", () => {
    expect(resolve("hmnd-toolbars=hidden").panelToolbarMode).toBe("hidden");
    expect(resolve("hmnd-toolbars=compact").panelToolbarMode).toBe("compact");
    expect(resolve("hmnd-toolbars=full").panelToolbarMode).toBe("full");
  });

  it("defaults toolbars to full when the parameter is absent", () => {
    expect(resolve("").panelToolbarMode).toBe("full");
    expect(resolve("hmnd-hide-appbar=1").panelToolbarMode).toBe("full");
  });

  it("locks the layout only for an explicit 1", () => {
    expect(resolve("hmnd-lock=1").layoutLocked).toBe(true);

    for (const query of ["hmnd-lock=0", "hmnd-lock", "hmnd-lock=true", "hmnd-lock=yes"]) {
      expect(resolve(query).layoutLocked).toBe(false);
    }
    expect(resolve("hmnd-unlock=1").layoutLocked).toBe(false);
  });

  it("collapses the sidebars only for an explicit 1", () => {
    expect(resolve("hmnd-hide-sidebars=1").collapseSidebars).toBe(true);

    for (const query of ["hmnd-hide-sidebars=0", "hmnd-hide-sidebars", ""]) {
      expect(resolve(query).collapseSidebars).toBe(false);
    }
    // The removed old parameter has no effect
    expect(resolve("hmnd-sidebars=1").collapseSidebars).toBe(false);
  });

  it("passes an unrecognised toolbar value straight through for the app to validate", () => {
    expect(resolve("hmnd-toolbars=nonsense").panelToolbarMode).toBe("nonsense");
  });

  it("combines every operator flag for a locked, minimal embed", () => {
    expect(
      resolve("hmnd-hide-appbar=1&hmnd-hide-sidebars=1&hmnd-toolbars=hidden&hmnd-lock=1"),
    ).toEqual({
      showAppBar: false,
      panelToolbarMode: "hidden",
      layoutLocked: true,
      collapseSidebars: true,
    });
  });

  it("ignores unrelated parameters the embed also carries", () => {
    expect(resolve("ds=foxglove-websocket&ds.url=ws://host:8765&layoutUrl=/x.json")).toEqual({
      showAppBar: true,
      panelToolbarMode: "full",
      layoutLocked: false,
      collapseSidebars: false,
    });
  });
});
