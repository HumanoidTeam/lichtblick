# web-hmnd

HMND's web entrypoint for Lichtblick Suite. It builds the same suite as `web/`,
but wired for embedding in HMND tooling rather than for standalone use:

- data sources limited to Foxglove WebSocket (live robots), local MCAP and local
  ROS 2 bags (fault investigation of recordings);
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
`layout`, …), this entrypoint adds `hmnd-appbar=1` to un-hide the app bar.
