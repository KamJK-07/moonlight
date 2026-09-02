import React, { useEffect, useMemo, useRef, useState } from 'react';
import { projectProgress } from '@moonlight/core';
import type { Project, Task } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;

const WIDTH = 1000;
const HEIGHT = 640;

type GraphNode = {
  id: string;
  kind: 'project' | 'task';
  refId: string;
  label: string;
  x: number;
  y: number;
  color: string | null;
  dimmed: boolean;
};

type GraphEdge = { source: string; target: string };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function buildGraph(projects: Project[], tasks: Task[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  projects.forEach((p, i) => {
    const angle = (i / Math.max(1, projects.length)) * Math.PI * 2;
    const r = Math.min(WIDTH, HEIGHT) * 0.28;
    nodes.push({
      id: `p:${p.id}`,
      kind: 'project',
      refId: p.id,
      label: p.name,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      color: p.color,
      dimmed: p.archived,
    });
  });

  const unlinked: Task[] = [];
  for (const t of tasks) {
    if (t.projectId && projects.some((p) => p.id === t.projectId)) {
      edges.push({ source: `p:${t.projectId}`, target: `t:${t.id}` });
    } else {
      unlinked.push(t);
    }
  }

  tasks.forEach((t) => {
    const parent = t.projectId ? nodes.find((n) => n.id === `p:${t.projectId}`) : undefined;
    const baseX = parent ? parent.x : cx;
    const baseY = parent ? parent.y : cy;
    const jitter = parent ? 60 : Math.min(WIDTH, HEIGHT) * 0.42;
    const angle = Math.random() * Math.PI * 2;
    const dist = parent ? Math.random() * jitter : jitter * (0.6 + Math.random() * 0.4);
    nodes.push({
      id: `t:${t.id}`,
      kind: 'task',
      refId: t.id,
      label: t.text,
      x: clamp(baseX + Math.cos(angle) * dist, 30, WIDTH - 30),
      y: clamp(baseY + Math.sin(angle) * dist, 30, HEIGHT - 30),
      color: null,
      dimmed: t.done,
    });
  });

  simulate(nodes, edges);
  return { nodes, edges };
}

function simulate(nodes: GraphNode[], edges: GraphEdge[]): void {
  const n = nodes.length;
  if (n === 0) return;
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const vx = new Array(n).fill(0);
  const vy = new Array(n).fill(0);
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  // The repulsion pass is O(n^2) per iteration; taper iteration count as the
  // graph grows so a few hundred tasks can't turn this into a multi-second stall.
  const iterations = n > 400 ? 25 : n > 150 ? 60 : 160;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[i]!.x - nodes[j]!.x;
        const dy = nodes[i]!.y - nodes[j]!.y;
        const distSq = Math.max(dx * dx + dy * dy, 4);
        const dist = Math.sqrt(distSq);
        const force = 1400 / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        vx[i] += fx;
        vy[i] += fy;
        vx[j] -= fx;
        vy[j] -= fy;
      }
    }
    for (const e of edges) {
      const i = index.get(e.source);
      const j = index.get(e.target);
      if (i === undefined || j === undefined) continue;
      const dx = nodes[j]!.x - nodes[i]!.x;
      const dy = nodes[j]!.y - nodes[i]!.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const force = (dist - 90) * 0.02;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      vx[i] += fx;
      vy[i] += fy;
      vx[j] -= fx;
      vy[j] -= fy;
    }
    for (let i = 0; i < n; i++) {
      vx[i] += (cx - nodes[i]!.x) * 0.0015;
      vy[i] += (cy - nodes[i]!.y) * 0.0015;
    }
    for (let i = 0; i < n; i++) {
      vx[i] *= 0.82;
      vy[i] *= 0.82;
      nodes[i]!.x = clamp(nodes[i]!.x + vx[i], 30, WIDTH - 30);
      nodes[i]!.y = clamp(nodes[i]!.y + vy[i], 30, HEIGHT - 30);
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function MapView({
  onClose,
  onOpenProject,
  onOpenTasks,
}: {
  onClose: () => void;
  onOpenProject: (id: string) => void;
  onOpenTasks: () => void;
}): React.ReactElement {
  const { state } = useWorklight();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<
    | { kind: 'pan'; startClient: { x: number; y: number }; startPan: { x: number; y: number }; moved: boolean }
    | { kind: 'node'; id: string; offset: { x: number; y: number }; startClient: { x: number; y: number }; moved: boolean }
    | null
  >(null);

  const { nodes: baseNodes, edges } = useMemo(
    () => buildGraph(state.projects, state.tasks),
    [state.projects, state.tasks],
  );
  const nodes = useMemo(
    () => baseNodes.map((n) => (positions[n.id] ? { ...n, ...positions[n.id] } : n)),
    [baseNodes, positions],
  );

  function toGraphPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function beginPan(e: React.PointerEvent): void {
    dragRef.current = { kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, startPan: pan, moved: false };
  }

  function beginNodeDrag(e: React.PointerEvent, node: GraphNode): void {
    e.stopPropagation();
    const graphPt = toGraphPoint(e.clientX, e.clientY);
    const under = { x: (graphPt.x - pan.x) / zoom, y: (graphPt.y - pan.y) / zoom };
    dragRef.current = {
      kind: 'node',
      id: node.id,
      offset: { x: under.x - node.x, y: under.y - node.y },
      startClient: { x: e.clientX, y: e.clientY },
      moved: false,
    };
  }

  useEffect(() => {
    function onMove(e: PointerEvent): void {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClient.x;
      const dy = e.clientY - drag.startClient.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      if (drag.kind === 'pan') {
        const startPt = toGraphPoint(drag.startClient.x, drag.startClient.y);
        const nowPt = toGraphPoint(e.clientX, e.clientY);
        setPan({ x: drag.startPan.x + (nowPt.x - startPt.x), y: drag.startPan.y + (nowPt.y - startPt.y) });
      } else {
        const graphPt = toGraphPoint(e.clientX, e.clientY);
        const under = { x: (graphPt.x - pan.x) / zoom, y: (graphPt.y - pan.y) / zoom };
        setPositions((prev) => ({
          ...prev,
          [drag.id]: { x: under.x - drag.offset.x, y: under.y - drag.offset.y },
        }));
      }
    }
    function onUp(): void {
      dragRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pan, zoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent): void {
      e.preventDefault();
      const factor = Math.pow(1.0015, -e.deltaY);
      setZoom((prevZoom) => {
        const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
        const graphPt = toGraphPoint(e.clientX, e.clientY);
        setPan((prevPan) => {
          const under = { x: (graphPt.x - prevPan.x) / prevZoom, y: (graphPt.y - prevPan.y) / prevZoom };
          return { x: graphPt.x - under.x * nextZoom, y: graphPt.y - under.y * nextZoom };
        });
        return nextZoom;
      });
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  function resetView(): void {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  const connected = useMemo(() => {
    if (!selected) return null;
    const ids = new Set<string>([selected.id]);
    for (const e of edges) {
      if (e.source === selected.id) ids.add(e.target);
      if (e.target === selected.id) ids.add(e.source);
    }
    return ids;
  }, [selected, edges]);

  const selectedProject = selected?.kind === 'project' ? state.projects.find((p) => p.id === selected.refId) : undefined;
  const selectedTask = selected?.kind === 'task' ? state.tasks.find((t) => t.id === selected.refId) : undefined;
  const selectedTaskProject = selectedTask?.projectId
    ? state.projects.find((p) => p.id === selectedTask.projectId)
    : undefined;
  const progress = selectedProject ? projectProgress(state.tasks, selectedProject) : null;

  return (
    <div className="map-overlay">
      <div className="map-header">
        <h2>Project map</h2>
        <div className="map-zoom-controls">
          <button className="btn-plain" onClick={() => setZoom((z) => clamp(z / 1.3, MIN_ZOOM, MAX_ZOOM))} aria-label="Zoom out">
            −
          </button>
          <button className="btn-plain" onClick={resetView} aria-label="Reset view">
            {Math.round(zoom * 100)}%
          </button>
          <button className="btn-plain" onClick={() => setZoom((z) => clamp(z * 1.3, MIN_ZOOM, MAX_ZOOM))} aria-label="Zoom in">
            +
          </button>
        </div>
        <button className="btn-plain" onClick={onClose} aria-label="Close project map">
          × Close
        </button>
      </div>
      <div className="map-body">
        <div className="map-canvas">
          {nodes.length === 0 ? (
            <p className="empty">Add a project or task to see it here.</p>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="map-svg"
              onPointerDown={beginPan}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {edges.map((e, i) => {
                  const a = nodes.find((n) => n.id === e.source);
                  const b = nodes.find((n) => n.id === e.target);
                  if (!a || !b) return null;
                  const active = !connected || (connected.has(a.id) && connected.has(b.id));
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className="map-edge"
                      opacity={active ? 0.6 : 0.12}
                    />
                  );
                })}
                {nodes.map((node) => {
                  const isProject = node.kind === 'project';
                  const r = isProject ? 15 : 6;
                  const active = !connected || connected.has(node.id);
                  const isSelected = selected?.id === node.id;
                  return (
                    <g
                      key={node.id}
                      className="map-node"
                      opacity={active ? (node.dimmed ? 0.5 : 1) : 0.15}
                      onPointerDown={(e) => beginNodeDrag(e, node)}
                      onClick={() => setSelected(node)}
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r}
                        fill={isProject ? node.color ?? 'var(--accent)' : 'var(--surface)'}
                        stroke={isSelected ? 'var(--accent)' : isProject ? 'transparent' : 'var(--accent)'}
                        strokeWidth={isSelected ? 3 : isProject ? 0 : 1.5}
                      />
                      <text x={node.x} y={node.y + r + 12} textAnchor="middle" className="map-label">
                        {truncate(node.label, isProject ? 22 : 18)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>
        <div className="map-detail">
          {!selected && <p className="empty">Click a node to see its details.</p>}
          {selectedProject && progress && (
            <div>
              <h3>{selectedProject.name}</h3>
              <span className={`pill ${selectedProject.status}`}>{selectedProject.status}</span>
              {selectedProject.githubRepo && (
                <p className="tag mono" style={{ marginTop: '0.6rem', display: 'inline-block' }}>
                  {selectedProject.githubRepo}
                </p>
              )}
              <div style={{ marginTop: '0.7rem' }}>
                {progress.total > 0 ? (
                  <>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
                    </div>
                    <div className="progress-label">
                      {progress.done}/{progress.total} tasks · {progress.pct}%
                    </div>
                  </>
                ) : (
                  <div className="progress-label">No tasks linked yet</div>
                )}
              </div>
              {selectedProject.notes.trim() && (
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginTop: '0.7rem', whiteSpace: 'pre-wrap' }}>
                  {selectedProject.notes}
                </p>
              )}
              <button className="btn-accent" style={{ marginTop: '0.8rem' }} onClick={() => onOpenProject(selectedProject.id)}>
                Open project →
              </button>
            </div>
          )}
          {selectedTask && (
            <div>
              <h3 style={{ fontSize: '0.95rem' }}>{selectedTask.text}</h3>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <span className="tag">{selectedTask.done ? 'Done' : 'Open'}</span>
                {selectedTask.priority === 'high' && <span className="tag priority-high">high</span>}
                {selectedTask.due && <span className="tag mono">{selectedTask.due}</span>}
              </div>
              {selectedTaskProject && (
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginTop: '0.6rem' }}>
                  In project <strong>{selectedTaskProject.name}</strong>
                </p>
              )}
              <button className="btn-plain" style={{ marginTop: '0.8rem' }} onClick={onOpenTasks}>
                Open in Tasks →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
