// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CSSProperties } from "react";

export type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  isUnknownPanel: boolean;
  /**
   * Hides the controls that change the layout or a panel's configuration, leaving the panel's own
   * `additionalIcons` in place. Set when the layout is locked.
   */
  hideEditControls?: boolean;
  /**
   * Drops the padding that would otherwise hold the toolbar well above the height of the icons it
   * contains. Set for the compact toolbar mode.
   */
  compact?: boolean;
};

export type PanelToolbarProps = {
  additionalIcons?: React.ReactNode;
  backgroundColor?: CSSProperties["backgroundColor"];
  children?: React.ReactNode;
  className?: string;
  isUnknownPanel?: boolean;
};
