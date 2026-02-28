import type { GraphEdge, GraphNode } from "../types/domain";

export interface PositionedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function positionNodes(nodes: GraphNode[], edges: GraphEdge[]): PositionedGraph {
  const placed = nodes.map((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = 180 + (index % 7) * 14;
    return {
      ...node,
      x: 240 + Math.cos(angle) * radius,
      y: 220 + Math.sin(angle) * radius,
    };
  });

  return { nodes: placed, edges };
}

export function colorForNeedTag(need: string): string {
  const normalized = need.toLowerCase();
  if (normalized.includes("fund") || normalized.includes("invest")) return "#f59e0b";
  if (normalized.includes("tech") || normalized.includes("code")) return "#0ea5e9";
  if (normalized.includes("sales") || normalized.includes("market")) return "#10b981";
  if (normalized.includes("design")) return "#8b5cf6";
  return "#64748b";
}
