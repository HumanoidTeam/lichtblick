/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen } from "@testing-library/react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@lichtblick/suite-base/components/PanelToolbar/constants";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { usePanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import {
  PanelToolbarMode,
  useLayoutLocked,
  usePanelToolbarMode,
} from "@lichtblick/suite-base/hooks/useOperatorChrome";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

jest.mock("@lichtblick/suite-base/hooks/useOperatorChrome", () => ({
  ...jest.requireActual("@lichtblick/suite-base/hooks/useOperatorChrome"),
  usePanelToolbarMode: jest.fn(),
  useLayoutLocked: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useSelectedPanels: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/PanelStateContext", () => ({
  usePanelStateStore: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/components/PanelToolbar/PanelActionsDropdown", () => ({
  PanelActionsDropdown: () => <div data-testid="panel-actions-dropdown" />,
}));
jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
  useDefaultPanelTitle: () => [undefined, jest.fn()],
}));

const mockToolbarMode = usePanelToolbarMode as jest.MockedFunction<typeof usePanelToolbarMode>;
const mockLayoutLocked = useLayoutLocked as jest.MockedFunction<typeof useLayoutLocked>;

function renderToolbar({
  mode = PanelToolbarMode.Full,
  locked = false,
}: {
  mode?: PanelToolbarMode;
  locked?: boolean;
} = {}) {
  mockToolbarMode.mockReturnValue(mode);
  mockLayoutLocked.mockReturnValue(locked);

  const connectToolbarDragHandle = jest.fn();
  const panelContext = {
    id: "panel-1",
    type: "TestPanel",
    title: "Test Panel",
    config: {},
    saveConfig: jest.fn(),
    updatePanelConfigs: jest.fn(),
    openSiblingPanel: jest.fn(),
    replacePanel: jest.fn(),
    enterFullscreen: jest.fn(),
    exitFullscreen: jest.fn(),
    isFullscreen: false,
    setHasFullscreenDescendant: jest.fn(),
    connectToolbarDragHandle,
    setMessagePathDropConfig: jest.fn(),
    logCount: 0,
    showLogs: false,
    setShowLogs: jest.fn(),
  } as any;

  render(
    <ThemeProvider isDark>
      <PanelContext.Provider value={panelContext}>
        <PanelToolbar />
      </PanelContext.Provider>
    </ThemeProvider>,
  );
  return { connectToolbarDragHandle };
}

beforeEach(() => {
  (useSelectedPanels as jest.Mock).mockReturnValue({ setSelectedPanelIds: jest.fn() });
  (usePanelStateStore as jest.Mock).mockReturnValue(false);
  (useWorkspaceActions as jest.Mock).mockReturnValue({ openPanelSettings: jest.fn() });
});

describe("PanelToolbar chrome modes", () => {
  it("renders the stock toolbar in full mode", () => {
    renderToolbar({ mode: PanelToolbarMode.Full });
    expect(screen.getByTestId("mosaic-drag-handle")).toBeDefined();
    expect(screen.getByTestId("panel-actions-dropdown")).toBeDefined();
  });

  it("renders nothing at all in hidden mode, so the panel reclaims the pixels", () => {
    renderToolbar({ mode: PanelToolbarMode.Hidden });
    // Not merely visually hidden: an element still in the flex column would keep its height
    expect(screen.queryByTestId("mosaic-drag-handle")).toBeNull();
    expect(screen.queryByTestId("panel-actions-dropdown")).toBeNull();
  });

  it("keeps the controls but shrinks the header in compact mode", () => {
    renderToolbar({ mode: PanelToolbarMode.Compact });
    const header = screen.getByTestId("mosaic-drag-handle");
    expect(header).toBeDefined();
    expect(screen.getByTestId("panel-actions-dropdown")).toBeDefined();

    const minHeight = getComputedStyle(header).minHeight;
    expect(minHeight).not.toBe(`${PANEL_TOOLBAR_MIN_HEIGHT}px`);
    expect(parseInt(minHeight, 10)).toBeLessThan(PANEL_TOOLBAR_MIN_HEIGHT);
  });

  it("connects the mosaic drag handle when the layout is unlocked", () => {
    const { connectToolbarDragHandle } = renderToolbar({ locked: false });
    expect(connectToolbarDragHandle).toHaveBeenCalled();
  });

  it("does not connect the drag handle when the layout is locked", () => {
    const { connectToolbarDragHandle } = renderToolbar({ locked: true });
    expect(connectToolbarDragHandle).not.toHaveBeenCalled();
  });

  it("hides the layout-mutating controls when the layout is locked", () => {
    renderToolbar({ locked: true });
    // The toolbar itself stays: the title and any panel-supplied icons are not layout controls
    expect(screen.getByTestId("mosaic-drag-handle")).toBeDefined();
    expect(screen.queryByTestId("panel-actions-dropdown")).toBeNull();
    expect(screen.queryByTitle("Settings")).toBeNull();
  });

  it("shows the panel settings button when the layout is unlocked", () => {
    renderToolbar({ locked: false });
    expect(screen.getByTitle("Settings")).toBeDefined();
  });
});
