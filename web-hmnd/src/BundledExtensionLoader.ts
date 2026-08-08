// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@lichtblick/log";
import type {
  ExtensionInfo,
  IExtensionLoader,
  InstallExtensionProps,
  Namespace,
  TypeExtensionLoader,
} from "@lichtblick/suite-base";
import type { LoadedExtension } from "@lichtblick/suite-base/services/extension/IExtensionLoader";

const log = Logger.getLogger(__filename);

const MANIFEST_PATH = "extensions/manifest.json";

/**
 * Serves the extensions that ship alongside the web bundle, as static files.
 *
 * Expected layout, relative to the served application root:
 *
 *     extensions/manifest.json          ExtensionInfo[]
 *     extensions/<id>/dist/extension.js the bundle named by a manifest entry
 *
 * `dist/extension.js` mirrors the path the same file occupies inside a `.foxe`
 * archive, so the same build output can be served either way.
 *
 * The namespace/type pair is load-bearing: ExtensionCatalogProvider's
 * `refreshAllExtensions` only visits loaders with `namespace === "local"` or
 * `type === "server"`, and the `"browser"` type is reserved for the loader
 * acting as the org cache. Manifest entries must also omit `externalId`, which
 * would otherwise route loading through the IndexedDB cache branch.
 */
export class BundledExtensionLoader implements IExtensionLoader {
  public readonly namespace: Namespace = "org";
  public readonly type: TypeExtensionLoader = "server";

  readonly #baseUrl: string;
  #extensions: Promise<ExtensionInfo[]> | undefined;

  public constructor(baseUrl = new URL(".", globalThis.document.baseURI).href) {
    this.#baseUrl = baseUrl;
  }

  public async getExtensions(): Promise<ExtensionInfo[]> {
    // Cache the in-flight promise: refreshAllExtensions may call this concurrently.
    this.#extensions ??= this.#fetchManifest();
    return await this.#extensions;
  }

  public async getExtension(id: string): Promise<ExtensionInfo | undefined> {
    const extensions = await this.getExtensions();
    return extensions.find((extension) => extension.id === id);
  }

  public async loadExtension(id: string): Promise<LoadedExtension> {
    const url = new URL(`extensions/${id}/dist/extension.js`, this.#baseUrl);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load extension ${id}: ${response.status} ${response.statusText}`);
    }
    return { raw: await response.text() };
  }

  public async installExtension(_data: InstallExtensionProps): Promise<ExtensionInfo> {
    throw new Error("Bundled extensions cannot be installed at runtime");
  }

  public async uninstallExtension(_id: string): Promise<void> {
    throw new Error("Bundled extensions cannot be uninstalled at runtime");
  }

  /**
   * A missing or malformed manifest means "this deployment ships no extensions",
   * not a failure — the app must still start.
   */
  async #fetchManifest(): Promise<ExtensionInfo[]> {
    const url = new URL(MANIFEST_PATH, this.#baseUrl);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        log.debug(`No bundled extension manifest at ${url.href} (${response.status})`);
        return [];
      }
      const manifest: unknown = await response.json();
      if (!Array.isArray(manifest)) {
        log.warn(`Bundled extension manifest at ${url.href} is not an array, ignoring`);
        return [];
      }
      return (manifest as ExtensionInfo[]).map((extension) => ({
        ...extension,
        namespace: this.namespace,
      }));
    } catch (err: unknown) {
      log.warn(`Failed to read bundled extension manifest at ${url.href}`, err);
      return [];
    }
  }
}
