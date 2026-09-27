/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2026 Humanoid

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import TimeBasedChartTooltipContent from "./TimeBasedChartTooltipContent";

const content = [
  { configIndex: 7, value: 70 },
  { configIndex: 2, value: 20 },
  { configIndex: 7, value: 71 },
];
const labels = { 2: "Earlier setting", 7: "Nearest sample" };

it("highlights the requested dataset after sorting without losing grouped overflow or values", () => {
  const original = content.map((item) => ({ ...item }));
  const { rerender, container } = render(
    <ThemeProvider isDark={false}>
      <TimeBasedChartTooltipContent
        content={content}
        multiDataset
        labelsByConfigIndex={labels}
        {...{ highlightedSeriesIndex: 7 }}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText("Nearest sample")).toHaveAttribute("data-highlighted", "true");
  expect(screen.getByText("Earlier setting")).not.toHaveAttribute("data-highlighted");
  expect(screen.getByText("70")).toBeVisible();
  expect(screen.getByText("20")).toBeVisible();
  expect(screen.getByText("<multiple values under cursor>")).toBeVisible();
  expect(container.textContent.indexOf("Earlier setting")).toBeLessThan(
    container.textContent.indexOf("Nearest sample"),
  );
  expect(content).toEqual(original);
  rerender(
    <ThemeProvider isDark={false}>
      <TimeBasedChartTooltipContent content={content} multiDataset labelsByConfigIndex={labels} />
    </ThemeProvider>,
  );
  expect(container.querySelector("[data-highlighted]")).toBeNull();
});

it.each([undefined, 0, 99])(
  "leaves other callers and unmatched indices unhighlighted (%s)",
  (highlightedSeriesIndex) => {
    const { container } = render(
      <ThemeProvider isDark>
        <TimeBasedChartTooltipContent
          content={content}
          multiDataset
          labelsByConfigIndex={labels}
          {...{ highlightedSeriesIndex }}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector("[data-highlighted]")).toBeNull();
    expect(screen.getByText("Nearest sample")).toBeVisible();
  },
);
