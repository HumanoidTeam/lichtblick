# web-hmnd

HMND's web entrypoint for Lichtblick Suite. It builds the same suite as `web/`,
but wired for embedding in HMND tooling rather than for standalone use:

- data sources limited to Foxglove WebSocket (live robots), local MCAP, remote
  MCAP files and local ROS 2 bags (fault investigation of recordings);
- the app bar is hidden, unless the URL carries `?hmnd-appbar=1` — layout
  authoring needs it;
- the open-on-startup data source dialog is off by default;
- extensions are served as static files next to the bundle, see
  `src/BundledExtensionLoader.ts`.

## Build

```sh
corepack yarn install --immutable
corepack yarn run web-hmnd:build:prod
```

The static bundle lands in `web-hmnd/.webpack` and can be served from any
static host — webpack's `publicPath` is `auto`, so it does not care what path
it is mounted at.

## URL parameters

Beyond the parameters suite-base itself understands (`ds`, `ds.*`, `layoutUrl`,
`layout`, …), this entrypoint adds:

- `hmnd-appbar=1`: show the app bar (and, by default, full panel toolbars).
- `hmnd-toolbars=full|compact|hidden`: panel toolbar mode.
- `hmnd-sidebars=1`: show the sidebars instead of starting them collapsed.
- `hmnd-lock=1`: lock the layout (no drag, split, resize, add or remove of
  panels). Without it the layout is unlocked, as in stock Lichtblick.

Only the exact value `1` enables a flag.

## Downstream entrypoint with extra panels

`src/index.ts` exports:

```ts
main(params?: {
  extraPanels?: PanelInfo[];
  extraSceneExtensions?: SceneExtensionConfig["extensionsById"];
}): Promise<void>
```

`src/entrypoint.tsx` calls `main()` with no parameters. `extraPanels` are added
to the built-in panel catalog (`WebRoot` prop `extraPanels`). `extraSceneExtensions`
are added to the scene extensions of the 3D and Image panels (`WebRoot` prop
`extraSceneExtensions`). A scene extension can use `renderer.rosApi`,
`renderer.setOverlay(id, element)` and `renderer.config.extensionSettings[id]`.

A downstream build uses its own entry file and its own webpack config:

```ts
// my-entry/src/entrypoint.tsx
import { main } from "<fork>/web-hmnd/src";

void main({
  extraPanels: [
    { title: "My panel", type: "MyPanel", module: async () => await import("./MyPanel") },
  ],
  extraSceneExtensions: {
    "my.SceneExtension": {
      init: (renderer) => new MySceneExtension(renderer),
      supportedInterfaceModes: ["3d"],
    },
  },
});
```

```ts
// my-entry/webpack.config.ts
import path from "path";

import { makeWebHmndConfig } from "<fork>/web-hmnd/webpack.config";

export default makeWebHmndConfig({
  contextPath: path.resolve(__dirname, "src"), // must also contain a tsconfig.json
  entrypoint: "./entrypoint.tsx",
  outputPath: path.resolve(__dirname, ".webpack"),
});
```
