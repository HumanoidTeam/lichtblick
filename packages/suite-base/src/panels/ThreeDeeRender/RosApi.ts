// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * The subset of the panel's ROS API that SceneExtensions can use to publish messages and call
 * services. Injected into the renderer by ThreeDeeRender, like `setAnalytics` injects
 * `IAnalytics`. Every member is optional: a data source that lacks a capability (an MCAP
 * recording, for example) leaves it undefined, and extensions render read-only.
 */
export type RosApi = {
  advertise?: (topic: string, schemaName: string, options?: Record<string, unknown>) => void;
  unadvertise?: (topic: string) => void;
  publish?: (topic: string, message: unknown) => void;
  callService?: (service: string, request: unknown) => Promise<unknown>;
  /** For example "ros1" or "ros2". Undefined when the data source does not tell. */
  dataSourceProfile?: string;
};
