// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * URL parameters that control the operator chrome.
 *
 * The deployment defaults are the frozen-operator ones — no app bar, no panel toolbars, locked
 * layout, collapsed sidebars — and every parameter here exists to *undo* one of them for layout
 * authoring. That direction matters: a frozen layout served without any parameters is the safe
 * configuration, so a dropped or mistyped parameter degrades towards locked rather than towards an
 * operator being able to rearrange a console mid-shift.
 *
 * The embedding iframe (Phase 4) builds these into its `src`; they are read once at startup.
 */

/** Restores the stock app bar. */
export const APP_BAR_PARAM = "hmnd-appbar";

/** `full` | `compact` | `hidden`. How much toolbar each panel renders. */
export const TOOLBARS_PARAM = "hmnd-toolbars";

/** Unlocks mosaic drag, split and resize, and the panel add/remove controls. */
export const UNLOCK_PARAM = "hmnd-unlock";

/** Restores the stock sidebars instead of starting them collapsed. */
export const SIDEBARS_PARAM = "hmnd-sidebars";

export type ChromeParams = {
  showAppBar: boolean;
  /** Passed through to `AppSetting.PANEL_TOOLBAR_MODE`; validated by `parsePanelToolbarMode`. */
  panelToolbarMode: string;
  layoutLocked: boolean;
  collapseSidebars: boolean;
};

/** True only for an explicit `=1`, so a bare or misspelled value does not unfreeze the layout. */
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
    layoutLocked: !isEnabled(params, UNLOCK_PARAM),
    collapseSidebars: !isEnabled(params, SIDEBARS_PARAM),
  };
}
