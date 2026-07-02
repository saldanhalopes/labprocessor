import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, RotateCcw, Loader2, MousePointer2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { LabLayout } from '../../services/layoutTypes';
import { useCanvasViewport } from '../../hooks/useCanvasViewport';

const DEFAULT_LAYOUT: LabLayout = {
  canvas: { width: 1080, height: 620 },
  backgroundImage: undefined,
  stationWidth: 140,
  stationHeight: 80,
  zones: [],
  rotas: [],
};

const ZONE_ALPHA = 0.08;

function drawLayout(
  ctx: CanvasRenderingContext2D,
  layout: LabLayout,
  bgImage: HTMLImageElement | null,
  showBackground: boolean,
  canvasW: number,
  canvasH: number,
  applyTransform: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void,
  selectedIdx: number | null
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvasW, canvasH);

  ctx.save();
  applyTransform(ctx, canvasW, canvasH);

  if (showBackground && bgImage) {
    ctx.drawImage(bgImage, 0, 0, layout.canvas.width, layout.canvas.height);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);
  }

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
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();

  const { vpRef, fitToContainer, screenToLayout, zoomAt, panBy, applyTransform, resetView } = useCanvasViewport(
    layout.canvas.width,
    layout.canvas.height
  );

  const dragRef = useRef<{
    type: 'pan' | 'station';
    startX: number;
    startY: number;
    stationIdx?: number;
    hasMoved: boolean;
  } | null>(null);

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
  useEffect(() => {
    if (!showBackground || !layout.backgroundImage) {
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
  }, [layout.backgroundImage, showBackground]);

  const measureContainer = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const w = c.clientWidth;
    const ratio = layout.canvas.height / layout.canvas.width;
    const h = w * ratio;
    setCanvasSize({ w, h });
    fitToContainer(w, h);
  }, [layout.canvas.width, layout.canvas.height, fitToContainer]);

  useEffect(() => { measureContainer(); }, [measureContainer]);
  useEffect(() => {
    const onResize = () => measureContainer();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureContainer]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvasSize.w * dpr);
    canvas.height = Math.floor(canvasSize.h * dpr);
    drawLayout(ctx, layout, bgImage, showBackground, canvasSize.w, canvasSize.h, applyTransform, selectedIdx);
  }, [layout, bgImage, showBackground, selectedIdx, canvasSize, applyTransform]);

  useEffect(() => { redraw(); }, [redraw]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lp = screenToLayout(e.clientX, e.clientY, canvasSize.w, canvasSize.h, rect);

    for (let i = layout.rotas.length - 1; i >= 0; i--) {
      const r = layout.rotas[i];
      if (lp.x >= r.x && lp.x <= r.x + layout.stationWidth && lp.y >= r.y && lp.y <= r.y + layout.stationHeight) {
        setSelectedIdx(i);
        dragRef.current = {
          type: 'station',
          startX: e.clientX,
          startY: e.clientY,
          stationIdx: i,
          hasMoved: false,
        };
        return;
      }
    }

    setSelectedIdx(null);
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
      const lp = screenToLayout(e.clientX, e.clientY, canvasSize.w, canvasSize.h, rect);
      let newX = Math.round(lp.x - layout.stationWidth / 2);
      let newY = Math.round(lp.y - layout.stationHeight / 2);
      newX = Math.max(0, Math.min(layout.canvas.width - layout.stationWidth, newX));
      newY = Math.max(0, Math.min(layout.canvas.height - layout.stationHeight, newY));
      setLayout(prev => ({
        ...prev,
        rotas: prev.rotas.map((r, i) =>
          i === dragRef.current!.stationIdx ? { ...r, x: newX, y: newY } : r
        ),
      }));
      setDirty(true);
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
    } else if (dragRef.current.type === 'pan') {
      panBy(dx, dy, canvasSize.w, canvasSize.h, canvasRef.current!.getBoundingClientRect());
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
    }
  };

  const onMouseUp = () => {
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

  const getCursorStyle = () => {
    if (dragRef.current?.type === 'station') return 'grabbing';
    if (dragRef.current?.type === 'pan' && dragRef.current.hasMoved) return 'grabbing';
    if (dragRef.current?.type === 'pan') return 'grab';
    return 'default';
  };

  const zoomPct = Math.round(vpRef.current.zoom / (vpRef.current.initialZoom || 1) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MousePointer2 size={16} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Editor de Layout do Laboratório (2D)</h3>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: layout.backgroundImage ? '#334155' : '#94a3b8' }}>
          <input
            type="checkbox"
            checked={showBackground}
            disabled={!layout.backgroundImage}
            onChange={(e) => setShowBackground(e.target.checked)}
          />
          Mostrar planta de fundo
        </label>
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
        Arraste as estações para reposicioná-las. Scroll = zoom, arraste no vazio = pan. Cores: azul = Máquina (MAQ), verde = Analista (MO), contorno amarelo = selecionado.
        {selectedIdx !== null && layout.rotas[selectedIdx] && (
          <span style={{ marginLeft: 8, color: '#1e293b' }}>
            Selecionado: <b>{layout.rotas[selectedIdx].rota}</b> — x={layout.rotas[selectedIdx].x}, y={layout.rotas[selectedIdx].y}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: canvasSize.h,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#f8fafc',
          position: 'relative',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <Loader2 size={24} className="animate-spin" /> Carregando layout...
          </div>
        ) : (
          <>
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
              <button
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  zoomAt(1.25, cx, cy, canvasSize.w, canvasSize.h, rect);
                }}
                title="Zoom in"
                style={zoomBtnStyle}
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  zoomAt(0.8, cx, cy, canvasSize.w, canvasSize.h, rect);
                }}
                title="Zoom out"
                style={zoomBtnStyle}
              >
                <ZoomOut size={14} />
              </button>
              <button onClick={() => resetView(canvasSize.w, canvasSize.h)} title="Ajustar à tela" style={zoomBtnStyle}>
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
          </>
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
