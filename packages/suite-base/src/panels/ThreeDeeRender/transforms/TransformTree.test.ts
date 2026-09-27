// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ObjectPool } from "@lichtblick/den/collection";
import { Transform } from "@lichtblick/suite-base/panels/ThreeDeeRender/transforms/Transform";

import { AddTransformResult, TransformTree } from "./TransformTree";
import { makePose } from "./geometry";

const tf = Transform.Identity();
describe("TransformTree", () => {
  it("updates tree when adding a transform that would not create a cycle", () => {
    const tfTree = new TransformTree(new ObjectPool(Transform.Empty));
    tfTree.addTransform("b", "a", 0n, tf);
    tfTree.addTransform("c", "b", 0n, tf);
    expect(tfTree.addTransform("d", "c", 0n, tf)).toEqual(AddTransformResult.UPDATED);
  });
  it("detects a cycle adding a transform that would create a cycle with 2 frames", () => {
    const tfTree = new TransformTree(new ObjectPool(Transform.Empty));
    // a <- b
    tfTree.addTransform("b", "a", 0n, tf);
    // b <- a <- b ERROR - cycle created
    expect(tfTree.addTransform("a", "b", 0n, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });
  it("detects a cycle when adding a transform that would create a cycle with 3 frames", () => {
    const tfTree = new TransformTree(new ObjectPool(Transform.Empty));
    // a <- b
    tfTree.addTransform("b", "a", 0n, tf);
    // a <- b <- c
    tfTree.addTransform("c", "b", 0n, tf);
    // c <- a <- b <- c  ERROR - cycle created
    expect(tfTree.addTransform("a", "c", 0n, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });
  it("detects a cycle when adding a transform with a parent as itself", () => {
    const tfTree = new TransformTree(new ObjectPool(Transform.Empty));
    expect(tfTree.addTransform("a", "a", 0n, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });

  it("supports deleting frames", () => {
    const tfTree = new TransformTree(new ObjectPool(Transform.Empty));
    tfTree.addTransform("b", "a", 0n, tf);
    tfTree.addTransform("c", "b", 0n, tf);
    tfTree.addTransform("c", "b", 1n, tf);
    tfTree.addTransform("d", "a", 0n, tf);

    // Remove non-existent transform is a no-op
    tfTree.removeTransform("c", "a", 0n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeDefined();
    expect(tfTree.frame("c")).toBeDefined();
    expect(tfTree.frame("d")).toBeDefined();

    // Remove transform from a->b, a is not deleted because it still has children
    tfTree.removeTransform("b", "a", 0n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeDefined();
    expect(tfTree.frame("c")).toBeDefined();
    expect(tfTree.frame("d")).toBeDefined();

    // Remove transform at 0 from b->c, nothing is deleted because there's still a transform at time 1
    tfTree.removeTransform("c", "b", 0n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeDefined();
    expect(tfTree.frame("c")).toBeDefined();
    expect(tfTree.frame("d")).toBeDefined();

    // Remove transform at 1 from b->c, b and c can now be deleted, a->d still exists
    tfTree.removeTransform("c", "b", 1n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeUndefined();
    expect(tfTree.frame("c")).toBeUndefined();
    expect(tfTree.frame("d")).toBeDefined();

    tfTree.removeTransform("d", "a", 0n);
    expect(tfTree.frame("a")).toBeUndefined();
    expect(tfTree.frame("b")).toBeUndefined();
    expect(tfTree.frame("c")).toBeUndefined();
    expect(tfTree.frame("d")).toBeUndefined();
  });

  describe("apply with the per-frame hop cache", () => {
    const TIME = 1n;
    const ROOT_TO_MID_X = 1;
    const MID_TO_LEAF_X = 2;
    const NEW_MID_TO_LEAF_X = 5;

    function leafOriginInRoot(tree: TransformTree): number | undefined {
      const out = makePose();
      const applied = tree.apply(out, makePose(), "root", "root", "leaf", TIME, TIME);
      return applied?.position.x;
    }

    it("returns the same result for repeated lookups at the same time", () => {
      const tree = new TransformTree(new ObjectPool(Transform.Empty));
      tree.addTransform("mid", "root", TIME, new Transform([ROOT_TO_MID_X, 0, 0], [0, 0, 0, 1]));
      tree.addTransform("leaf", "mid", TIME, new Transform([MID_TO_LEAF_X, 0, 0], [0, 0, 0, 1]));

      expect(leafOriginInRoot(tree)).toBeCloseTo(ROOT_TO_MID_X + MID_TO_LEAF_X);
      expect(leafOriginInRoot(tree)).toBeCloseTo(ROOT_TO_MID_X + MID_TO_LEAF_X);
    });

    it("recomputes a hop after its transform history changes at the same time", () => {
      const tree = new TransformTree(new ObjectPool(Transform.Empty));
      tree.addTransform("mid", "root", TIME, new Transform([ROOT_TO_MID_X, 0, 0], [0, 0, 0, 1]));
      tree.addTransform("leaf", "mid", TIME, new Transform([MID_TO_LEAF_X, 0, 0], [0, 0, 0, 1]));
      expect(leafOriginInRoot(tree)).toBeCloseTo(ROOT_TO_MID_X + MID_TO_LEAF_X);

      // Replace the transform at the same timestamp: the cached hop must not be reused
      tree.addTransform(
        "leaf",
        "mid",
        TIME,
        new Transform([NEW_MID_TO_LEAF_X, 0, 0], [0, 0, 0, 1]),
      );

      expect(leafOriginInRoot(tree)).toBeCloseTo(ROOT_TO_MID_X + NEW_MID_TO_LEAF_X);
    });

    it("does not cache hops of frames with a user offset", () => {
      const tree = new TransformTree(new ObjectPool(Transform.Empty));
      tree.addTransform("mid", "root", TIME, new Transform([ROOT_TO_MID_X, 0, 0], [0, 0, 0, 1]));
      tree.addTransform("leaf", "mid", TIME, new Transform([MID_TO_LEAF_X, 0, 0], [0, 0, 0, 1]));
      const offset: [number, number, number] = [0, 0, 0];
      tree.frame("leaf")!.offsetPosition = offset;
      expect(leafOriginInRoot(tree)).toBeCloseTo(ROOT_TO_MID_X + MID_TO_LEAF_X);

      // Offsets are mutable vectors; a change in place must be visible on the next lookup
      offset[0] = NEW_MID_TO_LEAF_X;

      expect(leafOriginInRoot(tree)).toBeCloseTo(ROOT_TO_MID_X + MID_TO_LEAF_X + NEW_MID_TO_LEAF_X);
    });
  });
});
