// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";

import {
  ConfigParams,
  devServerConfig,
  mainConfig,
  WebpackConfiguration,
} from "@lichtblick/suite-web/src/webpackConfigs";

import packageJson from "../package.json";

export type WebHmndConfigOptions = {
  /** Directory that holds `entrypoint` and a `tsconfig.json`. Default: `web-hmnd/src`. */
  contextPath?: string;
  /** Entry file, relative to `contextPath`. Default: `./entrypoint.tsx`. */
  entrypoint?: string;
  /** Output directory. Default: `web-hmnd/.webpack`. */
  outputPath?: string;
};

/**
 * Makes the web-hmnd webpack configs. A downstream build can call this from its own webpack
 * config with an entry file that imports `main` from `web-hmnd/src/index.ts` and passes its panels.
 */
export function makeWebHmndConfig(
  options: WebHmndConfigOptions = {},
): (WebpackConfiguration | ReturnType<typeof mainConfig>)[] {
  const params: ConfigParams = {
    outputPath: options.outputPath ?? path.resolve(__dirname, ".webpack"),
    contextPath: options.contextPath ?? path.resolve(__dirname, "src"),
    entrypoint: options.entrypoint ?? "./entrypoint.tsx",
    prodSourceMap: "source-map",
    version: packageJson.version,
  };
  return [devServerConfig(params), mainConfig(params)];
}

// foxglove-depcheck-used: webpack-dev-server
export default makeWebHmndConfig();
