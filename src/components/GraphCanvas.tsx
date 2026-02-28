import { useMemo } from "react";
import { colorForNeedTag, positionNodes } from "../lib/graph";
import type { GraphEdge, GraphNode } from "../types/domain";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

const WIDTH = 920;
const HEIGHT = 520;

export function GraphCanvas({ nodes, edges, selectedNodeId, onSelectNode }: GraphCanvasProps) {
  const graph = useMemo(() => positionNodes(nodes, edges), [nodes, edges]);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="graph-canvas" role="img" aria-label="Chapter network graph">
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="rgba(15, 23, 42, 0.25)" rx="16" />

      {graph.edges.map((edge) => {
        const from = graph.nodes.find((n) => n.id === edge.from);
        const to = graph.nodes.find((n) => n.id === edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={edge.type === "need_help" ? "#f59e0b" : "#34d399"}
            strokeWidth="1.5"
            opacity="0.6"
          />
        );
      })}

      {graph.nodes.map((node) => {
        const isSelected = selectedNodeId === node.id;
        return (
          <g key={node.id} onClick={() => onSelectNode(node.id)} className="graph-node" cursor="pointer">
            <circle
              cx={node.x}
              cy={node.y}
              r={isSelected ? 15 : 11}
              fill={colorForNeedTag(node.need)}
              stroke={isSelected ? "#fff" : "transparent"}
              strokeWidth="2"
            />
            <text x={(node.x ?? 0) + 16} y={(node.y ?? 0) + 4} fill="#f8fafc" fontSize="11">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
