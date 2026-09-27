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
  it("defaults to the operator configuration when no parameters are given", () => {
    // This is the case an embedding iframe hits, and the one a dropped parameter degrades to
    expect(resolve("")).toEqual({
      showAppBar: false,
      panelToolbarMode: "hidden",
      layoutLocked: false,
      collapseSidebars: true,
    });
  });

  it("restores the app bar and its toolbars together for layout authoring", () => {
    // Authoring means seeing the panel actions, so the two travel together by default
    expect(resolve("hmnd-appbar=1")).toMatchObject({
      showAppBar: true,
      panelToolbarMode: "full",
    });
  });

  it("lets the toolbar parameter override the app-bar pairing in either direction", () => {
    expect(resolve("hmnd-appbar=1&hmnd-toolbars=hidden")).toMatchObject({
      showAppBar: true,
      panelToolbarMode: "hidden",
    });
    expect(resolve("hmnd-toolbars=compact")).toMatchObject({
      showAppBar: false,
      panelToolbarMode: "compact",
    });
  });

  it("locks the layout only for an explicit 1", () => {
    expect(resolve("hmnd-lock=1").layoutLocked).toBe(true);

    // Anything else keeps the stock, unlocked layout
    for (const query of ["hmnd-lock=0", "hmnd-lock", "hmnd-lock=true", "hmnd-lock=yes"]) {
      expect(resolve(query).layoutLocked).toBe(false);
    }
    // The removed parameter has no effect
    expect(resolve("hmnd-unlock=1").layoutLocked).toBe(false);
  });

  it("restores the sidebars only for an explicit 1", () => {
    expect(resolve("hmnd-sidebars=1").collapseSidebars).toBe(false);
    expect(resolve("hmnd-sidebars=0").collapseSidebars).toBe(true);
    expect(resolve("hmnd-sidebars").collapseSidebars).toBe(true);
  });

  it("passes an unrecognised toolbar value straight through for the app to validate", () => {
    // Validation lives in parsePanelToolbarMode, which falls back to "full"; duplicating the
    // allowed set here would let the two drift
    expect(resolve("hmnd-toolbars=nonsense").panelToolbarMode).toBe("nonsense");
  });

  it("combines every authoring escape", () => {
    expect(resolve("hmnd-appbar=1&hmnd-sidebars=1")).toEqual({
      showAppBar: true,
      panelToolbarMode: "full",
      layoutLocked: false,
      collapseSidebars: false,
    });
  });

  it("ignores unrelated parameters the embed also carries", () => {
    expect(resolve("ds=foxglove-websocket&ds.url=ws://host:8765&layoutUrl=/x.json")).toEqual({
      showAppBar: false,
      panelToolbarMode: "hidden",
      layoutLocked: false,
      collapseSidebars: true,
    });
  });
});
