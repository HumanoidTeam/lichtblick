// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";

/**
 * Chrome settings for embedded, operator-facing deployments.
 *
 * These are read through app configuration rather than passed as props because their consumers —
 * `PanelToolbar` in particular — are rendered by every panel, far below any component an embedder
 * can reach. An embedder sets them once through `appConfigurationDefaults`; nothing writes them at
 * runtime, so a default supplied there is what the app sees.
 */

export const PanelToolbarMode = {
  /** Stock behaviour: title, panel actions and the drag handle. */
  Full: "full",
  /** Same controls at a reduced height, for layouts that need the pixels but not the loss. */
  Compact: "compact",
  /** No toolbar at all. Panels get their full pixel height. */
  Hidden: "hidden",
} as const;

export type PanelToolbarMode = (typeof PanelToolbarMode)[keyof typeof PanelToolbarMode];

const PANEL_TOOLBAR_MODES: readonly string[] = Object.values(PanelToolbarMode);

/**
 * Coerce a stored or URL-supplied value into a mode, falling back to `Full`.
 *
 * Unrecognised values fall back rather than throw: this value can come from a URL an operator
 * typed, and a mistyped parameter should leave the stock UI in place rather than break the app.
 */
export function parsePanelToolbarMode(value: unknown): PanelToolbarMode {
  return typeof value === "string" && PANEL_TOOLBAR_MODES.includes(value)
    ? (value as PanelToolbarMode)
    : PanelToolbarMode.Full;
}

/** How much toolbar each panel should render. */
export function usePanelToolbarMode(): PanelToolbarMode {
  const [value] = useAppConfigurationValue<string>(AppSetting.PANEL_TOOLBAR_MODE);
  return parsePanelToolbarMode(value);
}

/**
 * Whether the layout is frozen: no mosaic drag, split or resize, and no adding or removing panels.
 *
 * An unset value reads as unlocked, so the stock app is unaffected by this setting existing. The
 * operator deployment does not rely on that default: `web-hmnd` always supplies an explicit value,
 * and its own default is locked (see `chromeParams.ts`).
 */
export function useLayoutLocked(): boolean {
  const [value] = useAppConfigurationValue<boolean>(AppSetting.LAYOUT_LOCKED);
  return value === true;
}
