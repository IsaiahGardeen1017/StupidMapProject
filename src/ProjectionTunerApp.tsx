import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectionDefinition } from "./DataTypes";
import projectionPreviewCoastlines from "../data/derived/projection-preview-coastlines.json";
import { projectLonLat } from "./lib/projectionMath";

type PreviewLine = [number, number][];

const INITIAL_PROJECTION: ProjectionDefinition = {
  id: "projection-tuner",
  label: "Projection Tuner",
  projection: {
    kind: "lambert-conformal-conic",
    centralMeridian: 15,
    latitudeOfOrigin: 44.5,
    standardParallel1: 33,
    standardParallel2: 56
  },
  bounds: {
    minLongitude: -12,
    maxLongitude: 42,
    minLatitude: 29,
    maxLatitude: 60
  },
  width: 1400,
  height: 900,
  padding: 50
};

function NumberInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="projection-control">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step="0.5"
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
    </label>
  );
}

export default function ProjectionTunerApp() {
  const [definition, setDefinition] = useState(INITIAL_PROJECTION);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewLines = useMemo(() => projectionPreviewCoastlines as PreviewLine[], []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = "#d6c9ae";
    context.fillRect(0, 0, rect.width, rect.height);

    const renderDefinition: ProjectionDefinition = {
      ...definition,
      width: rect.width,
      height: rect.height,
      padding: 40
    };

    context.strokeStyle = "#3e3428";
    context.lineWidth = 1;

    for (const line of previewLines) {
      if (line.length < 2) {
        continue;
      }

      context.beginPath();
      for (let index = 0; index < line.length; index += 1) {
        const [longitude, latitude] = line[index];
        const point = projectLonLat({ longitude, latitude }, renderDefinition);
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      }
      context.stroke();
    }
  }, [definition, previewLines]);

  return (
    <main className="projection-page">
      <section className="projection-sidebar">
        <p className="eyebrow">Projection</p>
        <h1>Lambert Tuner</h1>
        <p className="hint">
          Tweak Lambert parameters and bounds in real time against a simplified coastline preview.
        </p>

        <div className="projection-group">
          <h2>Projection</h2>
          <NumberInput
            label="Central Meridian"
            value={definition.projection.kind === "lambert-conformal-conic" ? definition.projection.centralMeridian : 0}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                projection:
                  current.projection.kind === "lambert-conformal-conic"
                    ? { ...current.projection, centralMeridian: value }
                    : current.projection
              }));
            }}
          />
          <NumberInput
            label="Latitude Of Origin"
            value={definition.projection.kind === "lambert-conformal-conic" ? definition.projection.latitudeOfOrigin : 0}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                projection:
                  current.projection.kind === "lambert-conformal-conic"
                    ? { ...current.projection, latitudeOfOrigin: value }
                    : current.projection
              }));
            }}
          />
          <NumberInput
            label="Standard Parallel 1"
            value={definition.projection.kind === "lambert-conformal-conic" ? definition.projection.standardParallel1 : 0}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                projection:
                  current.projection.kind === "lambert-conformal-conic"
                    ? { ...current.projection, standardParallel1: value }
                    : current.projection
              }));
            }}
          />
          <NumberInput
            label="Standard Parallel 2"
            value={definition.projection.kind === "lambert-conformal-conic" ? definition.projection.standardParallel2 : 0}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                projection:
                  current.projection.kind === "lambert-conformal-conic"
                    ? { ...current.projection, standardParallel2: value }
                    : current.projection
              }));
            }}
          />
        </div>

        <div className="projection-group">
          <h2>Bounds</h2>
          <NumberInput
            label="Min Longitude"
            value={definition.bounds.minLongitude}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                bounds: { ...current.bounds, minLongitude: value }
              }));
            }}
          />
          <NumberInput
            label="Max Longitude"
            value={definition.bounds.maxLongitude}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                bounds: { ...current.bounds, maxLongitude: value }
              }));
            }}
          />
          <NumberInput
            label="Min Latitude"
            value={definition.bounds.minLatitude}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                bounds: { ...current.bounds, minLatitude: value }
              }));
            }}
          />
          <NumberInput
            label="Max Latitude"
            value={definition.bounds.maxLatitude}
            onChange={(value) => {
              setDefinition((current) => ({
                ...current,
                bounds: { ...current.bounds, maxLatitude: value }
              }));
            }}
          />
        </div>
      </section>

      <section className="projection-preview">
        <canvas className="projection-canvas" ref={canvasRef} />
      </section>
    </main>
  );
}
