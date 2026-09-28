// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const MS_PER_SECOND = 1000;

export type RenderRateLimiterClock = {
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (timer: unknown) => void;
};

const DEFAULT_CLOCK: RenderRateLimiterClock = {
  now: () => performance.now(),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  },
};

/**
 * Caps how often a render callback runs. A request inside the minimum interval schedules one
 * trailing render at the end of the interval; further requests before it runs are coalesced into
 * it. So the last request is always rendered, at most `1000 / maxFps` ms late.
 */
export class RenderRateLimiter {
  readonly #render: () => void;
  readonly #clock: RenderRateLimiterClock;
  #lastRenderMs = -Infinity;
  #timer: unknown;

  public constructor(render: () => void, clock: RenderRateLimiterClock = DEFAULT_CLOCK) {
    this.#render = render;
    this.#clock = clock;
  }

  /** Render now, or schedule one render. `maxFps` undefined or <= 0 means no cap. */
  public request(maxFps: number | undefined): void {
    if (maxFps == undefined || maxFps <= 0) {
      this.#render();
      return;
    }
    if (this.#timer != undefined) {
      return;
    }
    const waitMs = this.#lastRenderMs + MS_PER_SECOND / maxFps - this.#clock.now();
    if (waitMs <= 0) {
      this.#render();
      return;
    }
    this.#timer = this.#clock.setTimer(() => {
      this.#timer = undefined;
      this.#render();
    }, waitMs);
  }

  /** Record a render done by any path; a pending trailing render is no longer needed. */
  public rendered(): void {
    this.#lastRenderMs = this.#clock.now();
    this.cancel();
  }

  public cancel(): void {
    if (this.#timer != undefined) {
      this.#clock.clearTimer(this.#timer);
      this.#timer = undefined;
    }
  }
}
