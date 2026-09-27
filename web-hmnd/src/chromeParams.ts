// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * URL parameters that control the operator chrome.
 *
 * The deployment defaults are the operator ones — no app bar, no panel toolbars, collapsed
 * sidebars — and `hmnd-appbar`, `hmnd-toolbars` and `hmnd-sidebars` exist to *undo* one of them for
 * layout authoring. The layout lock is opt-in: the layout is unlocked (stock behavior) unless the
 * URL carries `hmnd-lock=1`.
 *
 * The embedding iframe (Phase 4) builds these into its `src`; they are read once at startup.
 */

/** Restores the stock app bar. */
export const APP_BAR_PARAM = "hmnd-appbar";

/** `full` | `compact` | `hidden`. How much toolbar each panel renders. */
export const TOOLBARS_PARAM = "hmnd-toolbars";

/** Locks mosaic drag, split and resize, and the panel add/remove controls. */
export const LOCK_PARAM = "hmnd-lock";

/** Restores the stock sidebars instead of starting them collapsed. */
export const SIDEBARS_PARAM = "hmnd-sidebars";

export type ChromeParams = {
  showAppBar: boolean;
  /** Passed through to `AppSetting.PANEL_TOOLBAR_MODE`; validated by `parsePanelToolbarMode`. */
  panelToolbarMode: string;
  layoutLocked: boolean;
  collapseSidebars: boolean;
};

/** True only for an explicit `=1`; a bare or misspelled value keeps the default. */
function isEnabled(params: URLSearchParams, name: string): boolean {
  return params.get(name) === "1";
}

export function resolveChromeParams(params: URLSearchParams): ChromeParams {
  const showAppBar = isEnabled(params, APP_BAR_PARAM);
  return {
    showAppBar,
    // Authoring a layout means seeing the panel actions, so restoring the app bar restores the
    // toolbars with it unless the parameter says otherwise.
    panelToolbarMode: params.get(TOOLBARS_PARAM) ?? (showAppBar ? "full" : "hidden"),
    layoutLocked: isEnabled(params, LOCK_PARAM),
    collapseSidebars: !isEnabled(params, SIDEBARS_PARAM),
  };
}
