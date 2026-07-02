import { useRef, useCallback } from 'react';

export interface Viewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  initialZoom: number;
  initialOffsetX: number;
  initialOffsetY: number;
}

export function createViewport(layoutW: number, layoutH: number): Viewport {
  return { zoom: 1, offsetX: 0, offsetY: 0, initialZoom: 1, initialOffsetX: 0, initialOffsetY: 0 };
}

export function useCanvasViewport(layoutW: number, layoutH: number) {
  const vpRef = useRef<Viewport>(createViewport(layoutW, layoutH));
  const initialFitRef = useRef<boolean>(false);

  const fitToContainer = useCallback((canvasW: number, canvasH: number) => {
    const margin = 0.92;
    const fitZoom = Math.min(canvasW / layoutW, canvasH / layoutH) * margin;
    vpRef.current.zoom = fitZoom;
    vpRef.current.offsetX = 0;
    vpRef.current.offsetY = 0;
    vpRef.current.initialZoom = fitZoom;
    vpRef.current.initialOffsetX = 0;
    vpRef.current.initialOffsetY = 0;
    initialFitRef.current = true;
  }, [layoutW, layoutH]);

  const screenToLayout = useCallback(
    (screenX: number, screenY: number, canvasW: number, canvasH: number, canvasRect: DOMRect) => {
      const { zoom, offsetX, offsetY } = vpRef.current;
      const cx = screenX - canvasRect.left;
      const cy = screenY - canvasRect.top;
      const sx = cx * (canvasW / canvasRect.width);
      const sy = cy * (canvasH / canvasRect.height);
      return {
        x: (sx - canvasW / 2 - offsetX * zoom) / zoom + layoutW / 2,
        y: (sy - canvasH / 2 - offsetY * zoom) / zoom + layoutH / 2,
      };
    },
    [layoutW, layoutH]
  );

  const zoomAt = useCallback(
    (factor: number, screenX: number, screenY: number, canvasW: number, canvasH: number, canvasRect: DOMRect) => {
      const { zoom, offsetX, offsetY } = vpRef.current;
      const cx = screenX - canvasRect.left;
      const cy = screenY - canvasRect.top;
      const sx = cx * (canvasW / canvasRect.width);
      const sy = cy * (canvasH / canvasRect.height);
      const newZoom = Math.max(0.15, Math.min(6, zoom * factor));
      const scaleChange = newZoom / zoom;
      vpRef.current.zoom = newZoom;
      vpRef.current.offsetX = (offsetX + (sx - canvasW / 2) / zoom) * scaleChange - (sx - canvasW / 2) / newZoom;
      vpRef.current.offsetY = (offsetY + (sy - canvasH / 2) / zoom) * scaleChange - (sy - canvasH / 2) / newZoom;
    },
    [layoutW, layoutH]
  );

  const panBy = useCallback(
    (dx: number, dy: number, canvasW: number, canvasH: number, canvasRect: DOMRect) => {
      const { zoom } = vpRef.current;
      const scaleX = canvasW / canvasRect.width;
      const scaleY = canvasH / canvasRect.height;
      vpRef.current.offsetX += (dx * scaleX) / zoom;
      vpRef.current.offsetY += (dy * scaleY) / zoom;
    },
    []
  );

  const applyTransform = useCallback(
    (ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
      if (!initialFitRef.current) {
        fitToContainer(canvasW, canvasH);
      }
      const { zoom, offsetX, offsetY } = vpRef.current;
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.translate(offsetX * zoom, offsetY * zoom);
      ctx.scale(zoom, zoom);
      ctx.translate(-layoutW / 2, -layoutH / 2);
    },
    [layoutW, layoutH, fitToContainer]
  );

  const resetView = useCallback(
    (canvasW: number, canvasH: number) => {
      const { initialZoom } = vpRef.current;
      vpRef.current.zoom = initialZoom || Math.min(canvasW / layoutW, canvasH / layoutH) * 0.92;
      vpRef.current.offsetX = 0;
      vpRef.current.offsetY = 0;
    },
    [layoutW, layoutH]
  );

  const getZoom = useCallback(() => vpRef.current.zoom, []);
  const getOffsetX = useCallback(() => vpRef.current.offsetX, []);
  const getOffsetY = useCallback(() => vpRef.current.offsetY, []);

  return {
    vpRef,
    fitToContainer,
    screenToLayout,
    zoomAt,
    panBy,
    applyTransform,
    resetView,
    getZoom,
    getOffsetX,
    getOffsetY,
  };
}
