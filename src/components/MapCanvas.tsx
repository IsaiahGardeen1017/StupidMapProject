import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent
} from "react";
import type { DateString, MapData } from "../DataTypes";
import { MAP_RENDER_CONFIG, MAP_VIEW_CONFIG } from "../global-configs";
import { getPolygonPath, getProvinceFill } from "../lib/mapMath";

type MapCanvasProps = {
  mapData: MapData;
  selectedDate: DateString;
};

type ViewportState = {
  centerX: number;
  centerY: number;
  zoom: number;
};

type DragState = {
  pointerId: number;
  lastClientX: number;
  lastClientY: number;
};

export function MapCanvas({ mapData, selectedDate }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    centerX: mapData.projection.width / 2,
    centerY: mapData.projection.height / 2,
    zoom: MAP_VIEW_CONFIG.initialZoom
  }));

  const worldSize = useMemo(
    () => ({
      width: mapData.projection.width,
      height: mapData.projection.height
    }),
    [mapData.projection.height, mapData.projection.width]
  );

  useEffect(() => {
    setViewport({
      centerX: worldSize.width / 2,
      centerY: worldSize.height / 2,
      zoom: MAP_VIEW_CONFIG.initialZoom
    });
  }, [worldSize.height, worldSize.width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = MAP_RENDER_CONFIG.backgroundFill;
    context.fillRect(0, 0, rect.width, rect.height);

    const fitScale = Math.min(
      rect.width / worldSize.width,
      rect.height / worldSize.height
    );
    const scale = fitScale * viewport.zoom;

    context.save();
    context.translate(rect.width / 2, rect.height / 2);
    context.scale(scale, scale);
    context.translate(-viewport.centerX, -viewport.centerY);

    for (const province of mapData.provinces) {
      if (!province.geometry?.exteriorRing?.length) {
        continue;
      }

      const provincePath = getPolygonPath(province.geometry.exteriorRing);
      context.fillStyle = getProvinceFill(
        province,
        selectedDate,
        mapData.participants
      );
      context.strokeStyle = MAP_RENDER_CONFIG.provinceStroke;
      context.lineWidth = MAP_RENDER_CONFIG.provinceStrokeWidth / scale;
      context.fill(provincePath);
      context.stroke(provincePath);

      if (province.geometry.holes.length > 0) {
        context.save();
        context.globalCompositeOperation = "destination-out";
        for (const hole of province.geometry.holes) {
          context.fill(getPolygonPath(hole));
        }
        context.restore();
      }
    }

    context.restore();
  }, [mapData, selectedDate, viewport, worldSize.height, worldSize.width]);

  function getCanvasMetrics() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const rect = canvas.getBoundingClientRect();
    const fitScale = Math.min(
      rect.width / worldSize.width,
      rect.height / worldSize.height
    );

    return {
      rect,
      fitScale,
      scale: fitScale * viewport.zoom
    };
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const metrics = getCanvasMetrics();
    if (!metrics) {
      return;
    }

    const { rect, scale } = metrics;
    const pointerScreenX = event.clientX - rect.left;
    const pointerScreenY = event.clientY - rect.top;

    const worldX =
      viewport.centerX + (pointerScreenX - rect.width / 2) / scale;
    const worldY =
      viewport.centerY + (pointerScreenY - rect.height / 2) / scale;

    const zoomFactor = Math.exp(-event.deltaY * MAP_VIEW_CONFIG.zoomIntensity);
    const nextZoom = Math.min(
      MAP_VIEW_CONFIG.maxZoom,
      Math.max(MAP_VIEW_CONFIG.minZoom, viewport.zoom * zoomFactor)
    );
    const nextScale = metrics.fitScale * nextZoom;

    const nextCenterX = worldX - (pointerScreenX - rect.width / 2) / nextScale;
    const nextCenterY = worldY - (pointerScreenY - rect.height / 2) / nextScale;

    setViewport({
      centerX: nextCenterX,
      centerY: nextCenterY,
      zoom: nextZoom
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const metrics = getCanvasMetrics();
    if (!metrics) {
      return;
    }

    const deltaX = event.clientX - dragState.lastClientX;
    const deltaY = event.clientY - dragState.lastClientY;
    dragStateRef.current = {
      ...dragState,
      lastClientX: event.clientX,
      lastClientY: event.clientY
    };

    setViewport((currentViewport) => ({
      ...currentViewport,
      centerX: currentViewport.centerX - deltaX / metrics.scale,
      centerY: currentViewport.centerY - deltaY / metrics.scale
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <canvas
      className="map-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      ref={canvasRef}
    />
  );
}
