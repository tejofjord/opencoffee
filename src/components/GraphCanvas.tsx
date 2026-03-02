import { useEffect, useMemo, useRef, type MouseEvent } from "react";
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
const NODE_RADIUS = 11;
const SELECTED_RADIUS = 15;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds = [],
  onSelectNode,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const graph = useMemo(() => positionNodes(nodes, edges), [nodes, edges]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const highlighted = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);
  const hasHighlights = highlighted.size > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    drawRoundedRect(ctx, 0, 0, WIDTH, HEIGHT, 16);
    ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
    ctx.fill();

    for (const edge of graph.edges) {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) continue;
      const edgeHighlighted = !hasHighlights || (highlighted.has(edge.from) && highlighted.has(edge.to));

      ctx.beginPath();
      ctx.moveTo(from.x ?? 0, from.y ?? 0);
      ctx.lineTo(to.x ?? 0, to.y ?? 0);
      ctx.strokeStyle = edge.type === "need_help" ? "#f59e0b" : "#34d399";
      ctx.globalAlpha = edgeHighlighted ? 0.72 : 0.22;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const shouldDrawAllLabels = graph.nodes.length <= 220;
    const selectable = new Set(
      graph.nodes
        .filter((node) => node.id === selectedNodeId || highlighted.has(node.id))
        .map((node) => node.id),
    );

    for (const node of graph.nodes) {
      const isSelected = selectedNodeId === node.id;
      const isHighlighted = !hasHighlights || highlighted.has(node.id);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      ctx.globalAlpha = isHighlighted ? 1 : 0.35;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? SELECTED_RADIUS : NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = colorForNeedTag(node.need);
      ctx.fill();

      if (isSelected) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }

      if (shouldDrawAllLabels || selectable.has(node.id)) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = `${isSelected ? 600 : 500} ${isSelected ? 12 : 11}px Outfit, sans-serif`;
        ctx.globalAlpha = isHighlighted ? 0.96 : 0.6;
        ctx.fillText(node.label, x + 16, y + 4);
      }
    }

    ctx.globalAlpha = 1;
  }, [graph.edges, graph.nodes, hasHighlights, highlighted, nodeById, selectedNodeId]);

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    let nearest: GraphNode | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const node of graph.nodes) {
      const nx = node.x ?? 0;
      const ny = node.y ?? 0;
      const distance = Math.hypot(x - nx, y - ny);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = node;
      }
    }

    if (nearest && nearestDistance <= 22) {
      onSelectNode(nearest.id);
    }
  }

  return (
    <div className="graph-canvas-wrap" role="img" aria-label="Chapter network graph">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        width={WIDTH}
        height={HEIGHT}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
