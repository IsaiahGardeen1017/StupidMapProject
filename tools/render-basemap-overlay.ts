import fs from "node:fs/promises";
import shp from "shpjs";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry
} from "geojson";
import {
  EUROPE_AUTHORING_PROJECTION,
  getSvgFooter,
  getSvgHeader,
  projectLonLat
} from "./lib/mapPipeline.js";
import {
  fileExists,
  resolveRepoPath,
  writeSvgAndPng
} from "./lib/nodeUtils.js";

async function loadFeatureCollection(zipPath: string) {
  const bytes = await fs.readFile(zipPath);
  const parsed = await shp(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );

  if (Array.isArray(parsed)) {
    const featureCollections = parsed.filter(
      (item): item is FeatureCollection => item.type === "FeatureCollection"
    );

    return featureCollections[0];
  }

  return parsed as FeatureCollection;
}

function featureToPaths(feature: Feature<Geometry, GeoJsonProperties>) {
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

function coordinatesToPath(ring: number[][]) {
  const projected = ring
    .map(([longitude, latitude]) => ({ longitude, latitude }))
    .map((coordinates) => projectLonLat(coordinates, EUROPE_AUTHORING_PROJECTION));

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

async function main() {
  const landZipPath = resolveRepoPath(
    "data",
    "raw",
    "natural-earth",
    "ne_10m_land.zip"
  );
  const coastlineZipPath = resolveRepoPath(
    "data",
    "raw",
    "natural-earth",
    "ne_10m_coastline.zip"
  );
  const outputPath = resolveRepoPath(
    "data",
    "derived",
    "europe-basemap-overlay.svg"
  );
  const outputPngPath = resolveRepoPath(
    "data",
    "derived",
    "europe-basemap-overlay.png"
  );

  if (!(await fileExists(landZipPath)) || !(await fileExists(coastlineZipPath))) {
    throw new Error(
      "Missing Natural Earth source files. Run `npm run tool:download-basemap` first."
    );
  }

  const [landCollection, coastlineCollection] = await Promise.all([
    loadFeatureCollection(landZipPath),
    loadFeatureCollection(coastlineZipPath)
  ]);

  const svgParts = [getSvgHeader(EUROPE_AUTHORING_PROJECTION, "#d4ccb5")];

  for (const feature of landCollection.features) {
    for (const polygon of featureToPaths(feature)) {
      const exterior = coordinatesToPath(polygon[0]);
      if (!exterior) {
        continue;
      }

      svgParts.push(
        `<path d="${exterior} Z" fill="#f7f2e4" stroke="#c1b28c" stroke-width="0.75" />`
      );
    }
  }

  for (const feature of coastlineCollection.features) {
    for (const line of featureToPaths(feature)) {
      const d = coordinatesToPath(line[0]);
      if (!d) {
        continue;
      }

      svgParts.push(
        `<path d="${d}" fill="none" stroke="#6b604f" stroke-width="1.25" />`
      );
    }
  }

  svgParts.push(getSvgFooter());
  const svgContent = svgParts.join("\n");
  await writeSvgAndPng(svgContent, outputPath, outputPngPath);
  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${outputPngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
