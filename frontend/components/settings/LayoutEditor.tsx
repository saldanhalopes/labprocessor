import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, RotateCcw, Loader2, MousePointer2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface LabRota {
  rota: string;
  tipo: string;
  execucao: string;
  zona: string;
  x: number;
  y: number;
}

interface LabZone {
  nome: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface LabLayout {
  canvas: { width: number; height: number };
  stationWidth: number;
  stationHeight: number;
  zones: LabZone[];
  rotas: LabRota[];
}

const DEFAULT_LAYOUT: LabLayout = {
  canvas: { width: 1080, height: 620 },
  stationWidth: 140,
  stationHeight: 80,
  zones: [],
  rotas: [],
};

const ZONE_ALPHA = 0.08;

function drawLayout(ctx: CanvasRenderingContext2D, layout: LabLayout, scale: number, selectedIdx: number | null) {
  ctx.clearRect(0, 0, layout.canvas.width * scale, layout.canvas.height * scale);
  ctx.save();
  ctx.scale(scale, scale);

  for (const zone of layout.zones) {
    ctx.fillStyle = hexWithAlpha(zone.color, ZONE_ALPHA);
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeStyle = hexWithAlpha(zone.color, 0.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    ctx.fillStyle = zone.color;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.fillText(zone.nome.toUpperCase(), zone.x + 10, zone.y + 18);
  }

  layout.rotas.forEach((r, idx) => {
    const isSelected = idx === selectedIdx;
    const fillColor = r.execucao === 'MAQ' ? '#1e3a8a' : '#065f46';
    ctx.fillStyle = fillColor;
    ctx.fillRect(r.x, r.y, layout.stationWidth, layout.stationHeight);
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#cbd5e1';
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.strokeRect(r.x, r.y, layout.stationWidth, layout.stationHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    wrapText(ctx, r.rota, r.x + 6, r.y + 18, layout.stationWidth - 12, 14);

    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${r.execucao} · ${r.zona}`, r.x + 6, r.y + layout.stationHeight - 8);
  });

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

function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const LayoutEditor: React.FC = () => {
  const [layout, setLayout] = useState<LabLayout>(DEFAULT_LAYOUT);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [dirty, setDirty] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ idx: number; offsetX: number; offsetY: number } | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/layout');
      const data = await res.json();
      if (data && data.rotas && data.rotas.length > 0) {
        setLayout(data);
        setDirty(false);
      } else {
        showToast('Nenhum layout encontrado. Defina via lab-layout.json.', 'info');
      }
    } catch (e: any) {
      showToast(`Erro ao carregar layout: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const computeScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return 1;
    const availableWidth = container.clientWidth - 32;
    return Math.min(1, availableWidth / layout.canvas.width);
  }, [layout.canvas.width]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = computeScale();
    canvas.width = layout.canvas.width * scale;
    canvas.height = layout.canvas.height * scale;
    drawLayout(ctx, layout, scale, selectedIdx);
  }, [layout, selectedIdx, computeScale]);

  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => {
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redraw]);

  const hitTest = useCallback((clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = computeScale();
    const mx = (clientX - rect.left) / scale;
    const my = (clientY - rect.top) / scale;
    for (let i = layout.rotas.length - 1; i >= 0; i--) {
      const r = layout.rotas[i];
      if (mx >= r.x && mx <= r.x + layout.stationWidth && my >= r.y && my <= r.y + layout.stationHeight) {
        return i;
      }
    }
    return null;
  }, [layout, computeScale]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const idx = hitTest(e.clientX, e.clientY);
    if (idx === null) { setSelectedIdx(null); return; }
    setSelectedIdx(idx);
    const r = layout.rotas[idx];
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = computeScale();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    dragState.current = { idx, offsetX: mx - r.x, offsetY: my - r.y };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragState.current === null) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = computeScale();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const { idx, offsetX, offsetY } = dragState.current;
    let newX = mx - offsetX;
    let newY = my - offsetY;
    newX = Math.max(0, Math.min(layout.canvas.width - layout.stationWidth, Math.round(newX)));
    newY = Math.max(0, Math.min(layout.canvas.height - layout.stationHeight, Math.round(newY)));
    setLayout(prev => ({
      ...prev,
      rotas: prev.rotas.map((r, i) => i === idx ? { ...r, x: newX, y: newY } : r),
    }));
    setDirty(true);
  };

  const onMouseUp = () => { dragState.current = null; };
  const onMouseLeave = () => { dragState.current = null; };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDirty(false);
      showToast('Layout salvo com sucesso.', 'success');
    } catch (e: any) {
      showToast(`Erro ao salvar: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (dirty && !window.confirm('Descartar alterações não salvas?')) return;
    load();
    setSelectedIdx(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MousePointer2 size={16} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Editor de Layout do Laboratório (2D)</h3>
        <span style={{ flex: 1 }} />
        <button onClick={reset} disabled={loading} style={btnStyle(false)}>
          <RotateCcw size={14} /> Recarregar
        </button>
        <button onClick={save} disabled={loading || saving || !dirty} style={btnStyle(true)}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar Layout {!dirty ? '' : '*'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#64748b' }}>
        Arraste as estações para reposicioná-las. Cores: azul = Máquina (MAQ), verde = Analista (MO), contorno amarelo = selecionado.
        {selectedIdx !== null && layout.rotas[selectedIdx] && (
          <span style={{ marginLeft: 8, color: '#1e293b' }}>
            Selecionado: <b>{layout.rotas[selectedIdx].rota}</b> — x={layout.rotas[selectedIdx].x}, y={layout.rotas[selectedIdx].y}
          </span>
        )}
      </div>

      <div ref={containerRef} style={{ width: '100%', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#f8fafc' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <Loader2 size={24} className="animate-spin" /> Carregando layout...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            style={{ display: 'block', cursor: dragState.current ? 'grabbing' : 'pointer', background: '#ffffff', borderRadius: 6 }}
          />
        )}
      </div>
    </div>
  );
};

const btnStyle = (primary: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 500,
  border: primary ? '1px solid #1e40af' : '1px solid #cbd5e1',
  background: primary ? '#1e40af' : '#ffffff',
  color: primary ? '#ffffff' : '#1e293b',
  borderRadius: 6,
  cursor: 'pointer',
});