import { describe, expect, it } from "vitest";
import { colorForNeedTag, positionNodes } from "./graph";
import type { GraphEdge, GraphNode } from "../types/domain";

describe("graph helpers", () => {
  it("positions all nodes inside the drawing bounds", () => {
    const nodes: GraphNode[] = Array.from({ length: 120 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
      need: "sales help",
      canHelp: "design",
      bio: null,
      websiteUrl: null,
      linkedinUrl: null,
    }));
    const edges: GraphEdge[] = [];

    const graph = positionNodes(nodes, edges);
    expect(graph.nodes).toHaveLength(nodes.length);
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(920);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(520);
    }
  });

  it("assigns stable colors for known need clusters", () => {
    expect(colorForNeedTag("fundraising help")).toBe("#f59e0b");
    expect(colorForNeedTag("technical cofounder")).toBe("#0ea5e9");
    expect(colorForNeedTag("sales support")).toBe("#10b981");
    expect(colorForNeedTag("design feedback")).toBe("#8b5cf6");
  });
});
