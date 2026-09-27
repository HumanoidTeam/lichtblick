// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { PanelInfo } from "@lichtblick/suite-base";
import { main as suiteWebMain } from "@lichtblick/suite-web";

import { resolveChromeParams } from "./chromeParams";

export type HmndMainParams = {
  /** Panels added to the built-in panel catalog. */
  extraPanels?: PanelInfo[];
};

/**
 * Renders the HMND web app. A downstream entrypoint calls this with its own panels; see
 * `web-hmnd/README.md`.
 */
export async function main(params: HmndMainParams = {}): Promise<void> {
  await suiteWebMain(async () => {
    // Imported lazily so the compatibility banner can render before the bulk of
    // the suite is downloaded, matching what suite-web's own main() does.
    const {
      AppContext,
      AppSetting,
      FoxgloveWebSocketDataSourceFactory,
      McapLocalDataSourceFactory,
      RemoteDataSourceFactory,
      Ros2LocalBagDataSourceFactory,
      StudioApp,
    } = await import("@lichtblick/suite-base");
    const { WebRoot } = await import("@lichtblick/suite-web/src/WebRoot");
    const { BundledExtensionLoader } = await import("./BundledExtensionLoader");
    const { createCollapsedSidebarStore } = await import("./collapsedSidebarStore");

    const chrome = resolveChromeParams(new URL(globalThis.location.href).searchParams);

    const HiddenAppBar = () => <></>;

    return {
      rootElement: (
        <WebRoot
          // Seeds the workspace store with both sidebars collapsed. This needs no core patch:
          // Workspace reads `workspaceStoreCreator` off AppContext, and StudioApp renders
          // extraProviders around Workspace.
          extraProviders={
            chrome.collapseSidebars
              ? [
                  <AppContext.Provider
                    key="hmnd-workspace-store"
                    value={{
                      wrapPlayer: (child) => child,
                      workspaceStoreCreator: createCollapsedSidebarStore,
                    }}
                  />,
                ]
              : undefined
          }
          // Live operations plus fault investigation of recordings; the remaining
          // stock sources are formats we do not produce.
          dataSources={[
            new FoxgloveWebSocketDataSourceFactory(),
            new McapLocalDataSourceFactory(),
            new RemoteDataSourceFactory(),
            new Ros2LocalBagDataSourceFactory(),
          ]}
          extensionLoaders={(defaultLoaders) => [...defaultLoaders, new BundledExtensionLoader()]}
          extraPanels={params.extraPanels}
          // Defaults rather than stored values, so a URL parameter decides what the app sees without
          // writing anything an operator would then be stuck with.
          appConfigurationDefaults={{
            [AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP]: false,
            [AppSetting.PANEL_TOOLBAR_MODE]: chrome.panelToolbarMode,
            [AppSetting.LAYOUT_LOCKED]: chrome.layoutLocked,
          }}
          enableLaunchPreferenceScreen={false}
          AppBarComponent={chrome.showAppBar ? undefined : HiddenAppBar}
        >
          <StudioApp />
        </WebRoot>
      ),
    };
  });
}
