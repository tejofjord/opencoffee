import { useMemo } from "react";
import { colorForNeedTag, positionNodes } from "../lib/graph";
import type { GraphEdge, GraphNode } from "../types/domain";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds?: string[];
  onSelectNode: (nodeId: string) => void;
}

const WIDTH = 920;
const HEIGHT = 520;

export function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds = [],
  onSelectNode,
}: GraphCanvasProps) {
  const graph = useMemo(() => positionNodes(nodes, edges), [nodes, edges]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const highlighted = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);
  const hasHighlights = highlighted.size > 0;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="graph-canvas" role="img" aria-label="Chapter network graph">
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="rgba(15, 23, 42, 0.25)" rx="16" />

      {graph.edges.map((edge) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to) return null;
        const edgeHighlighted = !hasHighlights || (highlighted.has(edge.from) && highlighted.has(edge.to));
        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={edge.type === "need_help" ? "#f59e0b" : "#34d399"}
            strokeWidth="1.5"
            opacity={edgeHighlighted ? 0.72 : 0.22}
          />
        );
      })}

      {graph.nodes.map((node) => {
        const isSelected = selectedNodeId === node.id;
        const isHighlighted = !hasHighlights || highlighted.has(node.id);
        return (
          <g
            key={node.id}
            onClick={() => onSelectNode(node.id)}
            className="graph-node"
            cursor="pointer"
            opacity={isHighlighted ? 1 : 0.35}
          >
            <title>{`${node.label} | Need: ${node.need} | Can help: ${node.canHelp}`}</title>
            <circle
              cx={node.x}
              cy={node.y}
              r={isSelected ? 15 : 11}
              fill={colorForNeedTag(node.need)}
              stroke={isSelected ? "#fff" : "transparent"}
              strokeWidth="2"
            />
            <text
              x={(node.x ?? 0) + 16}
              y={(node.y ?? 0) + 4}
              fill="#f8fafc"
              fontSize={isSelected ? "12" : "11"}
              opacity={isHighlighted ? 0.96 : 0.6}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
