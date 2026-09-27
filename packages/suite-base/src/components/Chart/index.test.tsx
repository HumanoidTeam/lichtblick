/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, render, screen } from "@testing-library/react";

import ErrorBoundary from "@lichtblick/suite-base/components/ErrorBoundary";
import Rpc, { createLinkedChannels } from "@lichtblick/suite-base/util/Rpc";

import Chart from ".";

let mockRpc: Rpc;

jest.mock("./worker/ChartJsMux", () => jest.fn());

jest.mock("@lichtblick/suite-base/util/WebWorkerManager", () => {
  Object.defineProperty(globalThis.HTMLCanvasElement.prototype, "transferControlToOffscreen", {
    configurable: true,
    value: jest.fn(() => ({})),
  });
  return {
    __esModule: true,
    default: jest.fn(() => ({
      registerWorkerListener: () => mockRpc,
      unregisterWorkerListener: () => {
        mockRpc.terminate();
      },
    })),
  };
});

describe("Chart worker initialization", () => {
  // Observe the real return value, including an incorrectly unhandled async callback.
  let queued: (() => unknown) | undefined;
  let rejectInitialize: (error: Error) => void;

  beforeEach(() => {
    queued = undefined;
    jest.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
      queued = callback;
    });
    const { local, remote } = createLinkedChannels();
    mockRpc = new Rpc(local);
    const receiver = new Rpc(remote);
    receiver.receive(
      "initialize",
      async () =>
        await new Promise((_resolve, reject) => {
          rejectInitialize = reject;
        }),
    );
    receiver.receive("destroy", () => undefined);
  });

  it("handles a pending initialization rejected by teardown", async () => {
    const onFinishRender = jest.fn();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(
      <Chart
        type="scatter"
        options={{}}
        width={400}
        height={300}
        isBoundsReset={false}
        onFinishRender={onFinishRender}
      />,
    );
    expect(queued).toBeDefined();
    const initializing = Promise.resolve(queued!());
    unmount();
    await expect(initializing).resolves.toBeUndefined();
    await act(async () => {});
    expect(onFinishRender).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("still shows a real initialization error while mounted", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary showErrorDetails>
        <Chart type="scatter" options={{}} width={400} height={300} isBoundsReset={false} />
      </ErrorBoundary>,
    );
    expect(queued).toBeDefined();
    await act(async () => {
      const initializing = Promise.resolve(queued!());
      rejectInitialize(new Error("Invalid chart configuration"));
      await initializing;
    });
    expect(screen.getByText("Invalid chart configuration", { exact: false })).not.toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid chart configuration" }),
    );
    consoleError.mockClear();
  });
});
