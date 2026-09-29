// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * URL parameters that control the operator chrome.
 *
 * The defaults show everything (stock Lichtblick behavior). Operator embeddings use the flags
 * below to hide UI and lock the layout. The embedding iframe builds these into its `src`; they
 * are read once at startup.
 */

/** Hides the app bar (layout menu, panel catalog, settings). */
export const HIDE_APP_BAR_PARAM = "hmnd-hide-appbar";

/** `full` | `compact` | `hidden`. Default is `full` (stock). */
export const TOOLBARS_PARAM = "hmnd-toolbars";

/** Locks mosaic drag, split and resize, and the panel add/remove controls. */
export const LOCK_PARAM = "hmnd-lock";

/** Collapses the sidebars on load. */
export const HIDE_SIDEBARS_PARAM = "hmnd-hide-sidebars";

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
  return {
    showAppBar: !isEnabled(params, HIDE_APP_BAR_PARAM),
    panelToolbarMode: params.get(TOOLBARS_PARAM) ?? "full",
    layoutLocked: isEnabled(params, LOCK_PARAM),
    collapseSidebars: isEnabled(params, HIDE_SIDEBARS_PARAM),
  };
}
