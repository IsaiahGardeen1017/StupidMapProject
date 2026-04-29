import fs from "node:fs/promises";
import shp from "shpjs";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { ProjectionDefinition } from "../../src/DataTypes.js";
import { projectLonLat } from "./mapPipeline.js";

export async function loadFeatureCollection(zipPath: string) {
  const bytes = await fs.readFile(zipPath);
  const parsed = await shp(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

  if (Array.isArray(parsed)) {
    const featureCollections = parsed.filter((item): item is FeatureCollection => item.type === "FeatureCollection");
    return featureCollections[0];
  }

  return parsed as FeatureCollection;
}

export function featureToPaths(feature: Feature<Geometry, GeoJsonProperties>) {
  const geometry = feature.geometry;
  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }

  if (geometry.type === "LineString") {
    return [[geometry.coordinates]];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.map((line) => [line]);
  }

  return [];
}

export function coordinatesToPath(ring: number[][], definition: ProjectionDefinition) {
  const projected = ring.map(([longitude, latitude]) => ({ longitude, latitude })).map((coordinates) => projectLonLat(coordinates, definition));

  if (projected.length < 2) {
    return "";
  }

  const [firstPoint, ...remainingPoints] = projected;
  const pathParts = [`M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`];
  for (const point of remainingPoints) {
    pathParts.push(`L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
  }

  return pathParts.join(" ");
}
