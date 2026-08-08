// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelToolbarMode, parsePanelToolbarMode } from "./useOperatorChrome";

describe("parsePanelToolbarMode", () => {
  it("accepts each supported mode", () => {
    expect(parsePanelToolbarMode("full")).toBe(PanelToolbarMode.Full);
    expect(parsePanelToolbarMode("compact")).toBe(PanelToolbarMode.Compact);
    expect(parsePanelToolbarMode("hidden")).toBe(PanelToolbarMode.Hidden);
  });

  it("falls back to the stock toolbar for anything unrecognised", () => {
    // This value can reach us from a URL an operator typed, so a mistake has to leave the stock UI
    // in place rather than break the app
    for (const value of ["", "Hidden", "none", "1", "hidden ", undefined, null, 3, {}, []]) {
      expect(parsePanelToolbarMode(value)).toBe(PanelToolbarMode.Full);
    }
  });
});
