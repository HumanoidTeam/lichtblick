/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { userEvent } from "@storybook/testing-library";
import { act, render, screen } from "@testing-library/react";
import EventEmitter from "eventemitter3";
import { useMemo } from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import { PlotLegend } from "./PlotLegend";
import { PlotCoordinatorEventTypes } from "./types";

const defaultProps = {
  showLegend: true,
  saveConfig: jest.fn(),
  sidebarDimension: BasicBuilder.number(),
  paths: [],
};

const getContextValue = () => ({
  type: "foo",
  id: "bar",
  title: "Foo Panel",
  config: {},
  saveConfig: jest.fn(),
  updatePanelConfigs: jest.fn(),
  exitFullscreen: jest.fn(),
  setHasFullscreenDescendant: jest.fn(),
  isFullscreen: false,
  connectToolbarDragHandle: jest.fn(),
  setMessagePathDropConfig: jest.fn(),
  openSiblingPanel: jest.fn(),
  replacePanel: jest.fn(),
  enterFullscreen: jest.fn(),
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const contextValue = useMemo(getContextValue, []);
  return (
    <PanelContext.Provider value={contextValue}>
      <div>{children}</div>
    </PanelContext.Provider>
  );
};

const setup = (overrides = {}) => {
  const props = { ...defaultProps, ...overrides };
  return render(
    <PanelContext.Provider value={getContextValue()}>
      <TestWrapper>
        <PlotLegend
          coordinator={undefined}
          legendDisplay="floating"
          onClickPath={jest.fn()}
          showValues={false}
          {...props}
        />
      </TestWrapper>
    </PanelContext.Provider>,
  );
};

jest.mock("@lichtblick/hooks", () => ({
  useGuaranteedContext: jest.fn(() => ({
    setState: jest.fn(),
    state: {},
  })),
  useSetState: jest.fn(),
  useContext: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutActions: jest.fn(() => ({
    getCurrentLayoutState: jest.fn(),
    setCurrentLayout: jest.fn(),
  })),
  useSelectedPanels: jest.fn(() => []),
}));

describe("PlotLegend", () => {
  const mockSetSelectedPanelIds = jest.fn();
  const path = BasicBuilder.string();
  const secondPath = BasicBuilder.string();

  beforeEach(() => {
    (useSelectedPanels as jest.Mock).mockReturnValue({
      setSelectedPanelIds: mockSetSelectedPanelIds,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each(["left", "top", "floating"])(
    "highlights only the enabled original series with values hidden (%s)",
    (legendDisplay) => {
      const paths = [
        { value: "/first", enabled: true, timestampMethod: "receiveTime" },
        { value: "/second", enabled: true, timestampMethod: "receiveTime" },
        { value: "/disabled", enabled: false, timestampMethod: "receiveTime" },
      ];
      const { container, unmount } = setup({ paths, legendDisplay, highlightedSeriesIndex: 1 });
      const highlighted = container.querySelectorAll("[data-highlighted=true]");
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0]).toHaveTextContent("/second");
      expect(highlighted[0]).not.toHaveTextContent("/first");
      unmount();
      const disabled = setup({ paths, legendDisplay, highlightedSeriesIndex: 2 });
      expect(disabled.container.querySelector("[data-highlighted=true]")).toBeNull();
    },
  );

  it("renders PlotLegend without crashing", () => {
    setup();
    expect(screen.getByTitle("Add series")).toBeDefined();
  });

  it("toggles legend visibility when IconButton is clicked", async () => {
    const mockSaveConfig = jest.fn();
    const { getByRole } = setup({ showLegend: false, saveConfig: mockSaveConfig });

    await userEvent.setup().click(getByRole("button"));

    expect(mockSaveConfig).toHaveBeenCalledWith({ showLegend: true });
  });

  it("renders paths from props", () => {
    const paths = [
      { value: path, enabled: true },
      { value: secondPath, enabled: true },
    ];
    setup({ paths });

    expect(screen.getByText(path)).toBeDefined();
    expect(screen.getByText(secondPath)).toBeDefined();
  });

  it("calls onClickPath when a path is clicked", async () => {
    const mockOnClickPath = jest.fn();
    const paths = [{ value: path, enabled: true }];

    setup({ paths, onClickPath: mockOnClickPath });

    await userEvent.setup().click(screen.getByText(path));

    expect(mockOnClickPath).toHaveBeenCalledWith(0);
  });

  const arrayPaths = [
    {
      value: "/sample.values[2:3]",
      label: "Joints",
      expandArrays: true,
      enabled: true,
      timestampMethod: "receiveTime",
    },
    { value: "/sample.scalar", label: "Scalar", enabled: true, timestampMethod: "receiveTime" },
  ];
  const arraySeries = [2, 3].map((arrayIndex, index) => ({
    configIndex: 0,
    arrayIndex,
    datasetIndex: index + 2,
    messagePath: `/sample.values[${arrayIndex}]`,
    color: "purple",
  }));

  it.each(["left", "top", "floating"])(
    "highlights the exact generated array child, not its parent or source index (%s)",
    (legendDisplay) => {
      const paths = [
        { value: "/disabled", enabled: false, timestampMethod: "receiveTime" },
        ...arrayPaths,
        { value: "1500", enabled: true, timestampMethod: "receiveTime" },
      ];
      const children = arraySeries.map((item, index) => ({
        ...item,
        configIndex: 1,
        datasetIndex: paths.length + index,
      }));
      const selected = children[1]!;
      const { container, unmount } = setup({
        paths,
        arraySeries: children,
        legendDisplay,
        highlightedSeriesIndex: selected.datasetIndex,
        showValues: false,
      });
      const highlighted = container.querySelectorAll("[data-highlighted=true]");
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0]).toHaveTextContent(`Joints [${selected.arrayIndex}]`);
      expect(highlighted[0]).not.toHaveTextContent("Scalar");
      unmount();
      const disabled = setup({
        paths: paths.map((seriesPath, index) =>
          index === selected.configIndex ? { ...seriesPath, enabled: false } : seriesPath,
        ),
        arraySeries: children,
        legendDisplay,
        highlightedSeriesIndex: selected.datasetIndex,
      });
      expect(disabled.container.querySelector("[data-highlighted=true]")).toBeNull();
    },
  );

  it("edits, hides and deletes the original array configuration from either child", async () => {
    const saveConfig = jest.fn();
    const onClickPath = jest.fn();
    setup({ paths: arrayPaths, arraySeries, saveConfig, onClickPath });
    expect(
      screen.getAllByTestId("plot-legend-row-path-label").map((item) => item.textContent),
    ).toEqual(["Joints [2]", "Joints [3]", "Scalar"]);
    await userEvent.setup().click(screen.getByText("Joints [3]"));
    expect(onClickPath).toHaveBeenLastCalledWith(0);
    await userEvent.setup().click(screen.getAllByRole("checkbox")[1]!);
    expect(saveConfig).toHaveBeenLastCalledWith({
      paths: [{ ...arrayPaths[0], enabled: false }, arrayPaths[1]],
    });
    await userEvent
      .setup()
      .click(screen.getAllByRole("button", { name: "Delete array series (all indices)" })[1]!);
    expect(saveConfig).toHaveBeenLastCalledWith({ paths: [arrayPaths[1]] });
    expect(arrayPaths[0]!.enabled).toBe(true);
    expect(arrayPaths.length).toBe(2);
  });

  it("uses per-index current values and clears missing indices instead of repeating an old scalar", () => {
    const coordinator = new EventEmitter<PlotCoordinatorEventTypes>();
    setup({ paths: arrayPaths, arraySeries, coordinator, showValues: true });
    act(() => {
      coordinator.emit("currentValuesChanged", [
        new Map([
          [2, 222],
          [3, 333],
        ]),
        444,
      ]);
    });
    expect(screen.getByText("222")).toBeDefined();
    expect(screen.getByText("333")).toBeDefined();
    expect(screen.getByText("444")).toBeDefined();
    act(() => {
      coordinator.emit("currentValuesChanged", [new Map([[2, 223]]), 444]);
    });
    expect(screen.queryByText("333")).toBeNull();
    expect(screen.getByText("223")).toBeDefined();
  });

  it("reads hovered child values by renderer dataset index, not original config index", () => {
    setup({
      paths: arrayPaths,
      arraySeries,
      showValues: true,
      hoveredValuesBySeriesIndex: [undefined, 444, 222, 333],
    });
    expect(screen.getByText("222")).toBeDefined();
    expect(screen.getByText("333")).toBeDefined();
    expect(screen.getByText("444")).toBeDefined();
  });
});
