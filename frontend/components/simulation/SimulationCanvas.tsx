import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { SimulationResult, ScheduledTask } from '../../services/scheduler';
import type { LabLayout, LabRota, LabZone } from '../../services/layoutTypes';
import { buildAgents, rotaCoord, corDeProduto, type AgentState } from './agents';
import { useCanvasViewport } from '../../hooks/useCanvasViewport';

export interface SimulationCanvasHandle {
  play: () => void;
  pause: () => void;
  reset: () => void;
  seek: (min: number) => void;
  setSpeed: (s: number) => void;
}

interface Props {
  sim: SimulationResult | null;
  layout: LabLayout;
  tiempo_min: number;
  onTiempoChange: (m: number) => void;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  onAgentSelect?: (a: AgentState | null) => void;
  onLayoutChange?: (layout: LabLayout) => void;
}

const SPEED_OPTIONS = [
  { label: '1s = 1min', value: 1 },
  { label: '1s = 10min', value: 10 },
  { label: '1s = 60min', value: 60 },
  { label: '1s = 300min', value: 300 },
];

function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  layout: LabLayout,
  bgImage: HTMLImageElement | null,
  sim: SimulationResult | null,
  agents: AgentState[],
  tiempo_min: number,
  canvasW: number,
  canvasH: number,
  applyTransform: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void,
  selectedAgentId: string | null,
  selectedRota: string | null,
  dragStationIdx: number | null
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvasW, canvasH);

  ctx.save();
  applyTransform(ctx, canvasW, canvasH);

  const W = layout.canvas.width;
  const H = layout.canvas.height;

  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);
  }

  for (const zone of layout.zones) {
    ctx.fillStyle = hexWithAlpha(zone.color, 0.06);
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeStyle = hexWithAlpha(zone.color, 0.50);
    ctx.lineWidth = 1;
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    ctx.fillStyle = zone.color;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.fillText(zone.nome.toUpperCase(), zone.x + 10, zone.y + 18);
  }

  layout.rotas.forEach((r, idx) => {
    const isBusy = agents.some((a) => a.rotaAtual === r.rota && a.state.startsWith('working'));
    const isSelected = selectedRota === r.rota;
    const isDragging = dragStationIdx === idx;
    const baseColor = r.execucao === 'MAQ' ? '#1e3a8a' : '#065f46';

    if (isBusy) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 250);
      ctx.shadowColor = r.execucao === 'MAQ' ? '#fbbf24' : '#34d399';
      ctx.shadowBlur = 18 + pulse * 14;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = baseColor;
    ctx.fillRect(r.x, r.y, layout.stationWidth, layout.stationHeight);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = isDragging ? '#f59e0b' : isSelected ? '#fbbf24' : isBusy ? '#facc15' : '#cbd5e1';
    ctx.lineWidth = isDragging ? 3 : isSelected || isBusy ? 2.5 : 1.2;
    ctx.strokeRect(r.x, r.y, layout.stationWidth, layout.stationHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    wrapText(ctx, r.rota, r.x + 6, r.y + 18, layout.stationWidth - 12, 14);
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = isBusy ? '#fde68a' : '#94a3b8';
    ctx.fillText(isBusy ? 'EM USO' : `${r.execucao}`, r.x + 6, r.y + layout.stationHeight - 8);
  });

  for (const a of agents) {
    const isSel = selectedAgentId === a.id;
    const radius = isSel ? 10 : 7;

    if (a.state === 'traveling') {
      ctx.strokeStyle = hexWithAlpha(a.cor, 0.6);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.targetX, a.targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (a.state.startsWith('working')) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 350);
      ctx.fillStyle = hexWithAlpha(a.cor, 0.25 + pulse * 0.25);
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius + 5 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = a.cor;
    ctx.beginPath();
    ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (isSel) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = w;
      curY += lineHeight;
      if (curY > y + lineHeight * 2) break;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}

function formatMin(total: number): string {
  const d = Math.floor(total / (60 * 24));
  const h = Math.floor((total % (60 * 24)) / 60);
  const m = Math.floor(total % 60);
  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export const SimulationCanvas = forwardRef<SimulationCanvasHandle, Props>(function SimulationCanvas(
  { sim, layout, tiempo_min, onTiempoChange, playing, onPlayingChange, speed, onSpeedChange, onAgentSelect, onLayoutChange },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const tiempoRef = useRef<number>(tiempo_min);
  const playingRef = useRef<boolean>(playing);
  const speedRef = useRef<number>(speed);
  const selectedAgentId = useRef<string | null>(null);
  const selectedRota = useRef<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
  const [localLayout, setLocalLayout] = useState<LabLayout>(layout);
  const [dragStationIdx, setDragStationIdx] = useState<number | null>(null);
  const [savingStation, setSavingStation] = useState<number | null>(null);

  const agentsRef = useRef<AgentState[]>(buildAgents(sim));

  const { vpRef, fitToContainer, screenToLayout, zoomAt, panBy, applyTransform, resetView } = useCanvasViewport(
    localLayout.canvas.width,
    localLayout.canvas.height
  );

  const dragRef = useRef<{
    type: 'pan' | 'station';
    startX: number;
    startY: number;
    stationIdx?: number;
    stationOrigX?: number;
    stationOrigY?: number;
    hasMoved: boolean;
  } | null>(null);

  useEffect(() => { tiempoRef.current = tiempo_min; }, [tiempo_min]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { agentsRef.current = buildAgents(sim); }, [sim]);
  useEffect(() => { setLocalLayout(layout); }, [layout]);

  useEffect(() => {
    if (!layout.backgroundImage) {
      setBgImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => setBgImage(img);
    img.onerror = () => setBgImage(null);
    img.src = layout.backgroundImage;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [layout.backgroundImage]);

  const measureContainer = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const w = c.clientWidth;
    const ratio = localLayout.canvas.height / localLayout.canvas.width;
    const h = w * ratio;
    setCanvasSize({ w, h });
    fitToContainer(w, h);
  }, [localLayout.canvas.width, localLayout.canvas.height, fitToContainer]);

  useEffect(() => {
    measureContainer();
    const onResize = () => measureContainer();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureContainer]);

  const loop = useCallback(() => {
    const now = performance.now();
    const dt = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;
    const hasSim = sim !== null;
    const makespan = sim?.makespan_min ?? 0;
    if (playingRef.current && hasSim) {
      const next = tiempoRef.current + dt * speedRef.current;
      const clamped = Math.min(next, makespan);
      tiempoRef.current = clamped;
      onTiempoChange(clamped);
      if (clamped >= makespan) {
        playingRef.current = false;
        onPlayingChange(false);
      }
    }
    const agents = hasSim
      ? agentsRef.current.map((a) => atualizarAgent(a, tiempoRef.current, sim!.tasks, localLayout))
      : [];
    agentsRef.current = agents;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(canvasSize.w * dpr);
        canvas.height = Math.floor(canvasSize.h * dpr);
        drawScene(
          ctx, localLayout, bgImage, sim, agents, tiempoRef.current,
          canvasSize.w, canvasSize.h, applyTransform,
          selectedAgentId.current, selectedRota.current, dragStationIdx
        );
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [sim, localLayout, bgImage, canvasSize, applyTransform, dragStationIdx, onTiempoChange, onPlayingChange]);

  useEffect(() => {
    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [loop]);

  const hitTestAgent = (clientX: number, clientY: number): AgentState | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const layoutPos = screenToLayout(clientX, clientY, canvasSize.w, canvasSize.h, rect);
    for (const a of agentsRef.current) {
      const dx = layoutPos.x - a.x;
      const dy = layoutPos.y - a.y;
      if (dx * dx + dy * dy < 144) return a;
    }
    return null;
  };

  const hitTestRota = (clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const layoutPos = screenToLayout(clientX, clientY, canvasSize.w, canvasSize.h, rect);
    const { stationWidth, stationHeight } = localLayout;
    for (let i = localLayout.rotas.length - 1; i >= 0; i--) {
      const r = localLayout.rotas[i];
      if (layoutPos.x >= r.x && layoutPos.x <= r.x + stationWidth && layoutPos.y >= r.y && layoutPos.y <= r.y + stationHeight) {
        return i;
      }
    }
    return null;
  };

  const saveLayout = useCallback(async (updatedLayout: LabLayout) => {
    try {
      const res = await fetch('/api/config/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLayout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onLayoutChange?.(updatedLayout);
    } catch {
      setLocalLayout(layout);
    }
  }, [layout, onLayoutChange]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const stationIdx = hitTestRota(e.clientX, e.clientY);
    if (stationIdx !== null) {
      setDragStationIdx(stationIdx);
      const r = localLayout.rotas[stationIdx];
      dragRef.current = {
        type: 'station',
        startX: e.clientX,
        startY: e.clientY,
        stationIdx,
        stationOrigX: r.x,
        stationOrigY: r.y,
        hasMoved: false,
      };
      return;
    }

    dragRef.current = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
    };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const totalMove = Math.abs(dx) + Math.abs(dy);

    if (totalMove < 3) return;

    dragRef.current.hasMoved = true;

    if (dragRef.current.type === 'station' && dragRef.current.stationIdx !== undefined) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const layoutPos = screenToLayout(e.clientX, e.clientY, canvasSize.w, canvasSize.h, rect);
      let newX = Math.round(layoutPos.x - localLayout.stationWidth / 2);
      let newY = Math.round(layoutPos.y - localLayout.stationHeight / 2);
      newX = Math.max(0, Math.min(localLayout.canvas.width - localLayout.stationWidth, newX));
      newY = Math.max(0, Math.min(localLayout.canvas.height - localLayout.stationHeight, newY));
      setLocalLayout(prev => ({
        ...prev,
        rotas: prev.rotas.map((r, i) =>
          i === dragRef.current!.stationIdx ? { ...r, x: newX, y: newY } : r
        ),
      }));
    } else if (dragRef.current.type === 'pan') {
      panBy(dx, dy, canvasSize.w, canvasSize.h, canvasRef.current!.getBoundingClientRect());
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;

    if (dragRef.current.type === 'station' && dragRef.current.stationIdx !== undefined) {
      setDragStationIdx(null);

      if (dragRef.current.hasMoved) {
        const idx = dragRef.current.stationIdx;
        const r = localLayout.rotas[idx];
        if (r.x !== dragRef.current.stationOrigX || r.y !== dragRef.current.stationOrigY) {
          setSavingStation(idx);
          saveLayout(localLayout).finally(() => setSavingStation(null));
        }
      }

      if (!dragRef.current.hasMoved) {
        const stationIdx = dragRef.current.stationIdx;
        selectedAgentId.current = null;
        selectedRota.current = localLayout.rotas[stationIdx].rota;
        const ag2 = agentsRef.current.find((x) => x.rotaAtual === localLayout.rotas[stationIdx].rota) || null;
        onAgentSelect?.(ag2);
      }

      dragRef.current = null;
      return;
    }

    if (dragRef.current.type === 'pan' && !dragRef.current.hasMoved) {
      const ag = hitTestAgent(e.clientX, e.clientY);
      if (ag) {
        selectedAgentId.current = ag.id;
        selectedRota.current = null;
        onAgentSelect?.(ag);
      } else {
        const stationIdx = hitTestRota(e.clientX, e.clientY);
        selectedAgentId.current = null;
        selectedRota.current = stationIdx !== null ? localLayout.rotas[stationIdx].rota : null;
        if (stationIdx !== null) {
          const ag2 = agentsRef.current.find((x) => x.rotaAtual === localLayout.rotas[stationIdx].rota) || null;
          onAgentSelect?.(ag2);
        } else {
          onAgentSelect?.(null);
        }
      }
    }

    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    zoomAt(factor, e.clientX, e.clientY, canvasSize.w, canvasSize.h, rect);
  };

  const onResetZoom = () => {
    resetView(canvasSize.w, canvasSize.h);
  };

  const onZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    zoomAt(1.25, cx, cy, canvasSize.w, canvasSize.h, rect);
  };

  const onZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    zoomAt(0.8, cx, cy, canvasSize.w, canvasSize.h, rect);
  };

  const getCursorStyle = () => {
    if (dragRef.current?.type === 'station') return 'grabbing';
    if (dragRef.current?.type === 'pan' && dragRef.current.hasMoved) return 'grabbing';
    if (dragRef.current?.type === 'pan') return 'grab';
    return 'default';
  };

  useImperativeHandle(ref, () => {
    const makespan = sim?.makespan_min ?? 0;
    return {
      play: () => {
        if (tiempoRef.current >= makespan) tiempoRef.current = 0;
        playingRef.current = true;
        onPlayingChange(true);
      },
      pause: () => { playingRef.current = false; onPlayingChange(false); },
      reset: () => {
        tiempoRef.current = 0;
        playingRef.current = false;
        onPlayingChange(false);
        onTiempoChange(0);
      },
      seek: (m: number) => { tiempoRef.current = Math.max(0, Math.min(m, makespan)); onTiempoChange(tiempoRef.current); },
      setSpeed: (s: number) => { speedRef.current = s; onSpeedChange(s); },
    };
  }, [sim?.makespan_min, onPlayingChange, onTiempoChange, onSpeedChange]);

  const progress = sim && sim.makespan_min > 0 ? (tiempo_min / sim.makespan_min) * 100 : 0;
  const tarefasConcluidas = sim ? sim.tasks.filter((t) => t.end_min <= tiempo_min).length : 0;
  const makespan = sim?.makespan_min ?? 0;
  const totalTasks = sim?.totalTasks ?? 0;
  const lotes = sim?.lotesSimulados ?? 0;

  const zoomPct = Math.round(vpRef.current.zoom / (vpRef.current.initialZoom || 1) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: canvasSize.h,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#ffffff',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: getCursorStyle(),
            background: 'transparent',
          }}
        />

        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        }}>
          <button onClick={onZoomIn} title="Zoom in" style={zoomBtnStyle}>
            <ZoomIn size={14} />
          </button>
          <button onClick={onZoomOut} title="Zoom out" style={zoomBtnStyle}>
            <ZoomOut size={14} />
          </button>
          <button onClick={onResetZoom} title="Ajustar à tela" style={zoomBtnStyle}>
            <Maximize2 size={14} />
          </button>
          <span style={{
            fontSize: 10,
            color: '#64748b',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 4,
            padding: '1px 4px',
            marginTop: 2,
          }}>
            {zoomPct}%
          </span>
        </div>

        {savingStation !== null && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: 11,
            color: '#1e40af',
            background: 'rgba(239,246,255,0.9)',
            padding: '4px 8px',
            borderRadius: 4,
            zIndex: 10,
          }}>
            Salvando posição...
          </div>
        )}

        {dragStationIdx !== null && localLayout.rotas[dragStationIdx] && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            fontSize: 10,
            color: '#1e293b',
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: 4,
            fontFamily: 'monospace',
            zIndex: 10,
          }}>
            {localLayout.rotas[dragStationIdx].rota}: x={localLayout.rotas[dragStationIdx].x}, y={localLayout.rotas[dragStationIdx].y}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#1e293b', borderRadius: 8, color: 'white' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, minWidth: 88 }}>
          {formatMin(tiempo_min)}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          / {formatMin(makespan)} · {tarefasConcluidas}/{totalTasks} tarefas · {lotes} lotes
        </span>
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 11, color: '#cbd5e1' }}>Velocidade:</label>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={{ background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}
        >
          {SPEED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ position: 'relative', height: 8, background: '#e2e8f0', borderRadius: 4, cursor: 'pointer' }}
        onClick={(e) => {
          if (!sim || !sim.makespan_min) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          const m = pct * sim.makespan_min;
          tiempoRef.current = m;
          onTiempoChange(m);
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress}%`, background: 'linear-gradient(to right, #1e40af, #3b82f6)', borderRadius: 4 }} />
      </div>

      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>● Azul = Máquina (MAQ)</span>
        <span>● Verde = Analista (MO)</span>
        <span>● <span style={{ color: '#dc2626' }}>●</span> Vermelho = amostra selecionável</span>
        <span>● Glow amarelo = equipamento ocupado</span>
        <span>● Scroll = zoom | Arrastar vazio = pan | Arrastar estação = reposicionar</span>
      </div>
    </div>
  );
});

function atualizarAgent(a: AgentState, tiempo_min: number, tasks: ScheduledTask[], layout: LabLayout): AgentState {
  const myTasks = tasks
    .filter((t) => t.produtoId === a.produtoId && t.testeName === a.testeName && t.lote === a.lote)
    .sort((x, y) => x.start_min - y.start_min);
  if (myTasks.length === 0) return { ...a, state: 'idle' };

  let active: ScheduledTask | null = null;
  for (const t of myTasks) {
    if (tiempo_min >= t.start_min && tiempo_min < t.end_min) { active = t; break; }
  }
  if (active) {
    const coord = rotaCoord(layout, active.rota);
    if (coord) {
      const tStart = active.start_min;
      const tEnd = active.end_min;
      const tDur = Math.max(1e-6, tEnd - tStart);
      const fromCoord =
        myTasks.findIndex((t) => t.taskId === active!.taskId) > 0
          ? rotaCoord(layout, myTasks[myTasks.findIndex((t) => t.taskId === active!.taskId) - 1].rota)
          : null;
      const progress = Math.min(1, (tiempo_min - tStart) / tDur);
      const interpX = fromCoord ? fromCoord.x + (coord.x - fromCoord.x) * Math.min(progress * 4, 1) : coord.x;
      const interpY = fromCoord ? fromCoord.y + (coord.y - fromCoord.y) * Math.min(progress * 4, 1) : coord.y;
      const arrivedX = progress > 0.05 ? coord.x : interpX;
      const arrivedY = progress > 0.05 ? coord.y : interpY;
      return {
        ...a,
        currentTaskId: active.taskId,
        state: progress > 0.05 ? (active.execucao === 'MAQ' ? 'working_maq' : 'working_mo') : 'traveling',
        x: arrivedX,
        y: arrivedY,
        targetX: coord.x,
        targetY: coord.y,
        taskStart: active.start_min,
        taskEnd: active.end_min,
        rotaAtual: active.rota,
        descricaoAtual: active.descricao,
        execucaoAtual: active.execucao,
      };
    }
  }

  const last = myTasks[myTasks.length - 1];
  if (tiempo_min >= last.end_min) {
    const coord = rotaCoord(layout, last.rota) || { x: 20, y: 20 };
    return { ...a, state: 'done', x: coord.x, y: coord.y, currentTaskId: null, rotaAtual: null, descricaoAtual: null, execucaoAtual: null };
  }

  const nextIdx = myTasks.findIndex((t) => t.start_min > tiempo_min);
  if (nextIdx > 0) {
    const prev = myTasks[nextIdx - 1];
    const next = myTasks[nextIdx];
    const prevCoord = rotaCoord(layout, prev.rota) || { x: 20, y: 20 };
    const nextCoord = rotaCoord(layout, next.rota) || { x: 20, y: 20 };
    const span = Math.max(1e-6, next.start_min - prev.end_min);
    const p = Math.min(1, Math.max(0, (tiempo_min - prev.end_min) / span));
    return {
      ...a,
      currentTaskId: null,
      state: 'traveling',
      x: prevCoord.x + (nextCoord.x - prevCoord.x) * p,
      y: prevCoord.y + (nextCoord.y - prevCoord.y) * p,
      targetX: nextCoord.x,
      targetY: nextCoord.y,
      rotaAtual: null,
      descricaoAtual: null,
      execucaoAtual: null,
    };
  }
  return { ...a, state: 'idle' };
}

const zoomBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.9)',
  color: '#1e293b',
  cursor: 'pointer',
  backdropFilter: 'blur(4px)',
};
