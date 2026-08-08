// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { main } from "@lichtblick/suite-web";

/** Set to 1 to restore the stock app bar, which layout authoring needs. */
const APP_BAR_PARAM = "hmnd-appbar";

const HiddenAppBar = () => <></>;

void main(async () => {
  // Imported lazily so the compatibility banner can render before the bulk of
  // the suite is downloaded, matching what suite-web's own main() does.
  const {
    AppSetting,
    FoxgloveWebSocketDataSourceFactory,
    McapLocalDataSourceFactory,
    Ros2LocalBagDataSourceFactory,
    StudioApp,
  } = await import("@lichtblick/suite-base");
  const { WebRoot } = await import("@lichtblick/suite-web/src/WebRoot");
  const { BundledExtensionLoader } = await import("./BundledExtensionLoader");

  const params = new URL(globalThis.location.href).searchParams;
  const showAppBar = params.get(APP_BAR_PARAM) === "1";

  return {
    rootElement: (
      <WebRoot
        extraProviders={undefined}
        // Live operations plus fault investigation of recordings; the remaining
        // stock sources are formats we do not produce.
        dataSources={[
          new FoxgloveWebSocketDataSourceFactory(),
          new McapLocalDataSourceFactory(),
          new Ros2LocalBagDataSourceFactory(),
        ]}
        extensionLoaders={(defaultLoaders) => [...defaultLoaders, new BundledExtensionLoader()]}
        appConfigurationDefaults={{ [AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP]: false }}
        enableLaunchPreferenceScreen={false}
        AppBarComponent={showAppBar ? undefined : HiddenAppBar}
      >
        <StudioApp />
      </WebRoot>
    ),
  };
});
