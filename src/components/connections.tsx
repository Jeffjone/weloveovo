'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
  type Node,
} from '@xyflow/react';
import { useReducedMotion } from 'motion/react';
import { ArrowUpRight, List, Map, RotateCcw } from 'lucide-react';
import type { GraphData, GraphNode } from '@/lib/types';
import { ui } from './ui';
import { useExperience } from './experience';
import s from './connections.module.css';
import '@xyflow/react/dist/style.css';
type MapNode = Node<GraphNode & Record<string, unknown>>;
function ConnectionNode({ data, selected }: NodeProps<MapNode>) {
  return (
    <div className={`${s.node} ${selected ? s.selected : ''}`}>
      <Handle type="target" position={Position.Top} />
      <span className={s.nodeType}>{data.kind.toUpperCase()}</span>
      <div className={s.nodeIdentity}>
        {data.image && <img src={data.image} width="32" height="32" alt="" />}
        <strong>{data.label}</strong>
      </div>
      <small>{data.description}</small>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { connection: ConnectionNode };
function MapCanvas({
  data,
  onSelect,
  selected,
}: {
  data: GraphData;
  onSelect: (node: GraphNode) => void;
  selected: string | null;
}) {
  const { fitView } = useReactFlow();
  const reduced = useReducedMotion();
  const { animated } = useExperience();
  const nodes = useMemo(
    () =>
      data.nodes.map((n) => ({
        id: n.id,
        type: 'connection',
        position: { x: n.x, y: n.y },
        data: n as GraphNode & Record<string, unknown>,
        selected: n.id === selected,
        ariaLabel: `${n.kind}: ${n.label}. ${n.description}`,
      })),
    [data, selected],
  );
  const edges = useMemo(
    () =>
      data.edges.map((e) => ({
        ...e,
        animated: animated && (e.source === selected || e.target === selected),
        label: e.label,
      })),
    [data, selected, animated],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void fitView({ padding: 0.15, duration: reduced ? 0 : 400, maxZoom: 1 });
    }, 70);
    return () => clearTimeout(timer);
  }, [data, fitView, reduced]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_e, n) => onSelect(n.data)}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      minZoom={0.18}
      maxZoom={1.5}
      proOptions={{ hideAttribution: false }}
      aria-label="Chronological connections map"
    >
      <Background color="#7098b42a" gap={26} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
export function Connections({ initial }: { initial: GraphData }) {
  const router = useRouter();
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<GraphNode | null>(
    initial.nodes.find((n) => n.id === initial.root) || null,
  );
  useEffect(() => {
    setSelected(initial.nodes.find((n) => n.id === initial.root) || null);
  }, [initial]);
  const select = useCallback(
    (node: GraphNode) => {
      setSelected(node);
      if (['era', 'release', 'track'].includes(node.kind))
        router.push('/connections?root=' + encodeURIComponent(node.id), { scroll: false });
    },
    [router],
  );
  return (
    <>
      <div className={s.toolbar}>
        <div role="group" aria-label="Connections view">
          <button aria-pressed={mode === 'map'} onClick={() => setMode('map')}>
            <Map size={14} />
            Map
          </button>
          <button aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
            <List size={14} />
            List
          </button>
        </div>
        <p>Select an era. Follow a record. Find a connection.</p>
        <button
          onClick={() => {
            setSelected(null);
            router.push('/connections', { scroll: false });
          }}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
      <div className={s.workspace}>
        <div
          className={s.canvas}
          onKeyDownCapture={(event) => {
            if (mode !== 'map' || !['Enter', ' '].includes(event.key)) return;
            const id = (event.target as HTMLElement)
              .closest('.react-flow__node')
              ?.getAttribute('data-id');
            const node = initial.nodes.find((n) => n.id === id);
            if (node) {
              event.preventDefault();
              event.stopPropagation();
              select(node);
            }
          }}
        >
          {mode === 'map' ? (
            <ReactFlowProvider>
              <MapCanvas data={initial} onSelect={select} selected={selected?.id || null} />
            </ReactFlowProvider>
          ) : (
            <div className={s.list}>
              {initial.nodes.map((node) => (
                <div key={node.id}>
                  <button onClick={() => select(node)}>
                    <span>{node.kind}</span>
                    <strong>{node.label}</strong>
                    <small>{node.description}</small>
                  </button>
                  <Link href={node.href} aria-label={`Open ${node.label}`}>
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className={s.details} aria-live="polite">
          {selected ? (
            <>
              <p className={ui.eyebrow}>{selected.kind} / SELECTED CONNECTION</p>
              {selected.image && <img src={selected.image} width="150" height="150" alt="" />}
              <h2>{selected.label}</h2>
              <p>{selected.description}</p>
              <Link className={ui.primaryButton} href={selected.href}>
                Enter this chapter <ArrowUpRight size={14} />
              </Link>
              <hr className={ui.divider} />
              <p className={ui.eyebrow}>CONNECTED TO</p>
              {initial.edges
                .filter((e) => e.source === selected.id || e.target === selected.id)
                .map((e) => {
                  const other = initial.nodes.find(
                    (n) => n.id === (e.source === selected.id ? e.target : e.source),
                  );
                  return other ? (
                    <button className={s.relation} key={e.id} onClick={() => select(other)}>
                      {other.label}
                      <ArrowUpRight size={12} />
                    </button>
                  ) : null;
                })}
            </>
          ) : (
            <>
              <span className={s.bigSix}>6</span>
              <p className={ui.eyebrow}>A WORLD OF CONNECTIONS</p>
              <h2>
                Nothing exists
                <br />
                on its own.
              </h2>
              <p>
                Start with an era to reveal the records, tracks, voices, and milestones around it.
              </p>
              <p>All paths are open. Follow your curiosity.</p>
            </>
          )}
        </aside>
      </div>
      <p className={s.mapNote}>
        Move with the map controls or switch to List for a linear view. Every chapter is open.
      </p>
    </>
  );
}
