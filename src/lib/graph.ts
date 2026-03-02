import type { GraphEdge, GraphNode } from "../types/domain";

export interface PositionedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const WIDTH = 920;
const HEIGHT = 520;

export function positionNodes(nodes: GraphNode[], edges: GraphEdge[]): PositionedGraph {
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const maxRingRadius = Math.min(centerX, centerY) - 34;
  const rings = Math.max(1, Math.ceil(Math.sqrt(nodes.length) / 2));

  const placed = nodes.map((node, index) => {
    const t = index / Math.max(1, nodes.length);
    const angle = t * Math.PI * 2 * 8.5;
    const ring = index % rings;
    const ringSpacing = maxRingRadius / Math.max(1, rings);
    const radius = 22 + ringSpacing * ring + ((index % 11) - 5) * 1.5;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
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
