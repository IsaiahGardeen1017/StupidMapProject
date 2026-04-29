import fs from "node:fs/promises";
import shp from "shpjs";
import type { FeatureCollection, GeoJsonProperties, Geometry, MultiLineString } from "geojson";
import { fileExists, resolveRepoPath } from "./lib/nodeUtils.js";

type PreviewLine = [number, number][];

const SOURCE_BOUNDS = {
  minLongitude: -40,
  maxLongitude: 80,
  minLatitude: 0,
  maxLatitude: 75
};

function isInsidePreviewBounds(longitude: number, latitude: number) {
  return (
    longitude >= SOURCE_BOUNDS.minLongitude &&
    longitude <= SOURCE_BOUNDS.maxLongitude &&
    latitude >= SOURCE_BOUNDS.minLatitude &&
    latitude <= SOURCE_BOUNDS.maxLatitude
  );
}

function simplifyCoordinates(points: [number, number][]) {
  if (points.length <= 2) {
    return points;
  }

  const simplified: [number, number][] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (index === 0 || index === points.length - 1 || index % 6 === 0) {
      simplified.push(points[index]);
    }
  }

  return simplified;
}

function splitVisibleRuns(points: [number, number][]) {
  const runs: PreviewLine[] = [];
  let currentRun: PreviewLine = [];

  for (const point of points) {
    const [longitude, latitude] = point;
    if (isInsidePreviewBounds(longitude, latitude)) {
      currentRun.push(point);
      continue;
    }

    if (currentRun.length >= 2) {
      runs.push(simplifyCoordinates(currentRun));
    }
    currentRun = [];
  }

  if (currentRun.length >= 2) {
    runs.push(simplifyCoordinates(currentRun));
  }

  return runs;
}

async function loadFeatureCollection(zipPath: string) {
  const bytes = await fs.readFile(zipPath);
  const parsed = await shp(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

  if (Array.isArray(parsed)) {
    const collection = parsed.find((item): item is FeatureCollection => item.type === "FeatureCollection");
    if (!collection) {
      throw new Error("No feature collection found in coastline zip.");
    }

    return collection;
  }

  return parsed as FeatureCollection;
}

function extractPreviewLines(featureCollection: FeatureCollection<Geometry, GeoJsonProperties>) {
  const previewLines: PreviewLine[] = [];

  for (const feature of featureCollection.features) {
    if (!feature.geometry) {
      continue;
    }

    if (feature.geometry.type === "LineString") {
      previewLines.push(...splitVisibleRuns(feature.geometry.coordinates as [number, number][]));
    }

    if (feature.geometry.type === "MultiLineString") {
      for (const line of feature.geometry.coordinates as MultiLineString["coordinates"]) {
        previewLines.push(...splitVisibleRuns(line as [number, number][]));
      }
    }
  }

  return previewLines;
}

async function main() {
  const coastlineZipPath = resolveRepoPath("data", "raw", "natural-earth", "ne_10m_coastline.zip");
  const outputPath = resolveRepoPath("data", "derived", "projection-preview-coastlines.json");

  if (!(await fileExists(coastlineZipPath))) {
    throw new Error("Missing Natural Earth coastline source file. Run `npm run tool:download-basemap` first.");
  }

  const featureCollection = await loadFeatureCollection(coastlineZipPath);
  const previewLines = extractPreviewLines(featureCollection);
  await fs.writeFile(outputPath, JSON.stringify(previewLines), "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
