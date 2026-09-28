// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RenderRateLimiter, RenderRateLimiterClock } from "./RenderRateLimiter";

const MAX_FPS = 20;
const INTERVAL_MS = 1000 / MAX_FPS;
const PLAYER_FRAME_MS = 10; // player frames at 100 Hz, faster than the cap
const PLAYER_FRAMES = 25;

/** Manual clock: timers run only when the test advances time. */
class FakeClock implements RenderRateLimiterClock {
  public nowMs = 0;
  #timers: { at: number; callback: () => void }[] = [];

  public now = (): number => this.nowMs;

  public setTimer = (callback: () => void, delayMs: number): unknown => {
    const timer = { at: this.nowMs + delayMs, callback };
    this.#timers.push(timer);
    return timer;
  };

  public clearTimer = (timer: unknown): void => {
    this.#timers = this.#timers.filter((entry) => entry !== timer);
  };

  public advance(ms: number): void {
    const end = this.nowMs + ms;
    for (;;) {
      const next = this.#timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) {
        break;
      }
      this.#timers = this.#timers.filter((t) => t !== next);
      this.nowMs = next.at;
      next.callback();
    }
    this.nowMs = end;
  }

  public pendingTimers(): number {
    return this.#timers.length;
  }
}

function setup() {
  const clock = new FakeClock();
  const renderTimes: number[] = [];
  const limiter: RenderRateLimiter = new RenderRateLimiter(() => {
    // The renderer reports every render back to the limiter, as Renderer.animationFrame does
    limiter.rendered();
    renderTimes.push(clock.nowMs);
  }, clock);
  return { clock, limiter, renderTimes };
}

describe("RenderRateLimiter", () => {
  it("renders on every request when there is no cap", () => {
    const { clock, limiter, renderTimes } = setup();
    for (let i = 0; i < PLAYER_FRAMES; i++) {
      limiter.request(undefined);
      clock.advance(PLAYER_FRAME_MS);
    }
    limiter.request(0);
    expect(renderTimes).toHaveLength(PLAYER_FRAMES + 1);
  });

  it("caps the render rate and never renders twice within the interval", () => {
    const { clock, limiter, renderTimes } = setup();
    for (let i = 0; i < PLAYER_FRAMES; i++) {
      limiter.request(MAX_FPS);
      clock.advance(PLAYER_FRAME_MS);
    }
    clock.advance(INTERVAL_MS);

    const totalMs = PLAYER_FRAMES * PLAYER_FRAME_MS;
    expect(renderTimes.length).toBeLessThanOrEqual(Math.ceil(totalMs / INTERVAL_MS) + 1);
    expect(renderTimes.length).toBeLessThan(PLAYER_FRAMES);
    const gaps = renderTimes.slice(1).map((t, i) => t - renderTimes[i]!);
    expect(gaps.every((gap) => gap >= INTERVAL_MS)).toBe(true);
  });

  it("always renders the last request, at most one interval late", () => {
    const { clock, limiter, renderTimes } = setup();
    limiter.request(MAX_FPS); // renders at once
    clock.advance(PLAYER_FRAME_MS);
    limiter.request(MAX_FPS); // inside the interval: deferred
    const lastRequestMs = clock.nowMs;
    expect(renderTimes).toEqual([0]);

    clock.advance(INTERVAL_MS);

    expect(renderTimes).toHaveLength(2);
    expect(renderTimes[1]! - lastRequestMs).toBeLessThanOrEqual(INTERVAL_MS);
    expect(clock.pendingTimers()).toBe(0);
  });

  it("drops the trailing render when another path rendered first", () => {
    const { clock, limiter, renderTimes } = setup();
    limiter.request(MAX_FPS);
    clock.advance(PLAYER_FRAME_MS);
    limiter.request(MAX_FPS); // deferred

    limiter.rendered(); // e.g. a seek frame rendered synchronously
    clock.advance(INTERVAL_MS);

    expect(renderTimes).toEqual([0]);
    expect(clock.pendingTimers()).toBe(0);
  });
});
