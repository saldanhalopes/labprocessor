import { useRef, useCallback } from 'react';
import type { LabRota } from '../services/layoutTypes';

export interface ResizeHandle {
  id: string;
  x: number;
  y: number;
  cursor: string;
  controls: ('n' | 's' | 'w' | 'e')[];
}

export interface ResizeState {
  stationIdx: number;
  handleId: string;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  keepAspect: boolean;
}

const HANDLE_SIZE = 8;
const MIN_W = 40;
const MIN_H = 28;
const HANDLE_HIT_RADIUS = 10;

export function stationWidth(r: LabRota, defaultW: number): number {
  return r.width ?? defaultW;
}

export function stationHeight(r: LabRota, defaultH: number): number {
  return r.height ?? defaultH;
}

export function getResizeHandles(r: LabRota, defaultW: number, defaultH: number): ResizeHandle[] {
  const w = stationWidth(r, defaultW);
  const h = stationHeight(r, defaultH);
  return [
    { id: 'nw', x: r.x, y: r.y, cursor: 'nwse-resize', controls: ['n', 'w'] },
    { id: 'n', x: r.x + w / 2, y: r.y, cursor: 'ns-resize', controls: ['n'] },
    { id: 'ne', x: r.x + w, y: r.y, cursor: 'nesw-resize', controls: ['n', 'e'] },
    { id: 'w', x: r.x, y: r.y + h / 2, cursor: 'ew-resize', controls: ['w'] },
    { id: 'e', x: r.x + w, y: r.y + h / 2, cursor: 'ew-resize', controls: ['e'] },
    { id: 'sw', x: r.x, y: r.y + h, cursor: 'nesw-resize', controls: ['s', 'w'] },
    { id: 's', x: r.x + w / 2, y: r.y + h, cursor: 'ns-resize', controls: ['s'] },
    { id: 'se', x: r.x + w, y: r.y + h, cursor: 'nwse-resize', controls: ['s', 'e'] },
  ];
}

export function hitTestHandle(
  layoutX: number,
  layoutY: number,
  handles: ResizeHandle[],
  zoom: number
): string | null {
  const hitRadius = HANDLE_HIT_RADIUS / zoom;
  for (const h of handles) {
    const dx = layoutX - h.x;
    const dy = layoutY - h.y;
    if (Math.abs(dx) <= hitRadius && Math.abs(dy) <= hitRadius) {
      return h.id;
    }
  }
  return null;
}

export function calculateResize(
  r: LabRota,
  handleId: string,
  newLayoutX: number,
  newLayoutY: number,
  defaultW: number,
  defaultH: number,
  keepAspect: boolean,
  canvasW: number,
  canvasH: number
): { x: number; y: number; width: number; height: number } {
  const handles = getResizeHandles(r, defaultW, defaultH);
  const handle = handles.find(h => h.id === handleId);
  if (!handle) return { x: r.x, y: r.y, width: stationWidth(r, defaultW), height: stationHeight(r, defaultH) };

  const oldW = stationWidth(r, defaultW);
  const oldH = stationHeight(r, defaultH);
  const aspect = oldW / oldH;
  const oldRight = r.x + oldW;
  const oldBottom = r.y + oldH;

  let x = r.x;
  let y = r.y;
  let w = oldW;
  let h = oldH;

  const ctrlN = handle.controls.includes('n');
  const ctrlS = handle.controls.includes('s');
  const ctrlW = handle.controls.includes('w');
  const ctrlE = handle.controls.includes('e');

  if (ctrlW) {
    const maxX = oldRight - MIN_W;
    x = Math.min(newLayoutX, maxX);
    x = Math.max(0, x);
    w = oldRight - x;
  }
  if (ctrlE) {
    w = Math.max(MIN_W, newLayoutX - x);
    w = Math.min(w, canvasW - x);
  }
  if (ctrlN) {
    const maxY = oldBottom - MIN_H;
    y = Math.min(newLayoutY, maxY);
    y = Math.max(0, y);
    h = oldBottom - y;
  }
  if (ctrlS) {
    h = Math.max(MIN_H, newLayoutY - y);
    h = Math.min(h, canvasH - y);
  }

  if (keepAspect && (ctrlN || ctrlS) && (ctrlW || ctrlE)) {
    const newAspect = w / Math.max(1, h);
    if (newAspect > aspect) {
      w = h * aspect;
      if (ctrlW) x = oldRight - w;
    } else {
      h = w / aspect;
      if (ctrlN) y = oldBottom - h;
    }
  }

  return { x, y, width: Math.round(w), height: Math.round(h) };
}

export function useResizableStation(defaultW: number, defaultH: number) {
  const resizeRef = useRef<ResizeState | null>(null);

  const startResize = useCallback(
    (stationIdx: number, handleId: string, r: LabRota, keepAspect: boolean) => {
      const w = stationWidth(r, defaultW);
      const h = stationHeight(r, defaultH);
      resizeRef.current = {
        stationIdx,
        handleId,
        origX: r.x,
        origY: r.y,
        origW: w,
        origH: h,
        keepAspect,
      };
      return resizeRef.current;
    },
    [defaultW, defaultH]
  );

  const updateResize = useCallback(
    (layoutX: number, layoutY: number, rotas: LabRota[], canvasW: number, canvasH: number): Partial<LabRota> | null => {
      const rs = resizeRef.current;
      if (!rs) return null;
      const r = rotas[rs.stationIdx];
      if (!r) return null;

      return calculateResize(
        r,
        rs.handleId,
        layoutX,
        layoutY,
        defaultW,
        defaultH,
        rs.keepAspect,
        canvasW,
        canvasH
      );
    },
    [defaultW, defaultH]
  );

  const endResize = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const isResizing = useCallback(() => resizeRef.current !== null, []);

  return { resizeRef, startResize, updateResize, endResize, isResizing };
}

export function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  handles: ResizeHandle[],
  zoom: number
) {
  const size = HANDLE_SIZE / zoom;
  for (const h of handles) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
    ctx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
  }
}

export { HANDLE_SIZE, MIN_W, MIN_H, HANDLE_HIT_RADIUS };
