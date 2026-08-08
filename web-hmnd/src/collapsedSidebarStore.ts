// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoreApi, createStore } from "zustand";

import { makeWorkspaceContextInitialState } from "@lichtblick/suite-base";
import type { WorkspaceContextStore } from "@lichtblick/suite-base/src/context/Workspace/WorkspaceContext";

/**
 * A workspace store that starts with both sidebars collapsed and does not persist.
 *
 * `Workspace` takes this off `AppContext.workspaceStoreCreator`, so seeding the sidebars needs no
 * core patch at all — only the initial state differs from the stock store.
 *
 * Persistence is deliberately dropped rather than merely excluding the sidebar keys. The stock
 * store persists across mounts, which for an embedded console means a sidebar an operator opened
 * once stays open through every later mode switch — the opposite of what a frozen layout is for.
 * The cost is that `playbackControls` (repeat, sync) and feature-tour state also reset per mount,
 * which is the same reset the pinned `layoutUrl` already performs on the layout itself.
 */
export function createCollapsedSidebarStore(
  initialState?: Partial<WorkspaceContextStore>,
): StoreApi<WorkspaceContextStore> {
  return createStore<WorkspaceContextStore>()(() => {
    const defaults = makeWorkspaceContextInitialState();
    return {
      ...defaults,
      ...initialState,
      sidebars: {
        left: { ...defaults.sidebars.left, open: false },
        right: { ...defaults.sidebars.right, open: false },
      },
    };
  });
}
