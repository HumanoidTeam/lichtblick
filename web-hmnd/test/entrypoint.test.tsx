/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as React from "react";

let mockMainParams: { rootElement?: React.JSX.Element } | undefined;

const makeDataSourceFactory = (name: string) =>
  class DataSourceFactory {
    public readonly name = name;
  };

const mockFactories = {
  FoxgloveWebSocketDataSourceFactory: makeDataSourceFactory("foxglove-websocket"),
  McapLocalDataSourceFactory: makeDataSourceFactory("mcap-local"),
  RemoteDataSourceFactory: makeDataSourceFactory("remote"),
  Ros2LocalBagDataSourceFactory: makeDataSourceFactory("ros2-local-bag"),
};

const mockMain = jest.fn(async (getParams: () => Promise<typeof mockMainParams>) => {
  mockMainParams = await getParams();
});

jest.mock("@lichtblick/suite-web", () => ({ main: mockMain }));

jest.mock("@lichtblick/suite-base", () => ({
  AppContext: { Provider: () => null },
  AppSetting: {
    SHOW_OPEN_DIALOG_ON_STARTUP: "showOpenDialogOnStartup",
    PANEL_TOOLBAR_MODE: "panelToolbarMode",
    LAYOUT_LOCKED: "layoutLocked",
  },
  ...mockFactories,
  StudioApp: () => null,
}));

jest.mock("@lichtblick/suite-web/src/WebRoot", () => ({
  WebRoot: () => null,
}));

jest.mock("../src/BundledExtensionLoader", () => ({
  BundledExtensionLoader: jest.fn(),
}));

jest.mock("../src/collapsedSidebarStore", () => ({
  createCollapsedSidebarStore: jest.fn(),
}));

describe("HMND web entrypoint", () => {
  beforeAll(async () => {
    Object.assign(globalThis, { React });
    await import("../src/entrypoint");
  });

  it("keeps the HMND data sources and exposes the remote MCAP source", () => {
    const rootElement = mockMainParams?.rootElement;
    const dataSources = rootElement?.props.dataSources as Array<{ name: string }>;

    expect(dataSources.map((dataSource) => dataSource.name)).toEqual([
      "foxglove-websocket",
      "mcap-local",
      "remote",
      "ros2-local-bag",
    ]);
  });
});
