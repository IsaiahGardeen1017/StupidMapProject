import fs from "node:fs/promises";
import path from "node:path";
import { EUROPE_AUTHORING_PROJECTION, getSvgFooter, getSvgHeader, isInsideBounds, projectLonLat } from "./lib/mapPipeline.js";
import {
  fileExists,
  resolveRepoPath,
  writeSvgAndPng
} from "./lib/nodeUtils.js";

type GeoNamesRecord = {
  geonameId: string;
  name: string;
  asciiName: string;
  alternateNames: string;
  latitude: number;
  longitude: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  population: number;
};

function parseGeoNamesLine(line: string): GeoNamesRecord | undefined {
  if (!line.trim()) {
    return undefined;
  }

  const columns = line.split("\t");
  if (columns.length < 15) {
    return undefined;
  }

  return {
    geonameId: columns[0],
    name: columns[1],
    asciiName: columns[2],
    alternateNames: columns[3],
    latitude: Number(columns[4]),
    longitude: Number(columns[5]),
    featureClass: columns[6],
    featureCode: columns[7],
    countryCode: columns[8],
    population: Number(columns[14])
  };
}

function pickLabel(record: GeoNamesRecord) {
  return record.asciiName || record.name;
}

function scoreSettlement(record: GeoNamesRecord) {
  const featureBoost =
    record.featureCode === "PPLC"
      ? 4
      : record.featureCode === "PPLA"
        ? 3
        : record.featureCode === "PPL"
          ? 2
          : 1;

  return featureBoost * 1_000_000 + record.population;
}

async function main() {
  const rawTextPath = resolveRepoPath(
    "data",
    "raw",
    "geonames",
    "cities500.txt"
  );
  const outputPath = resolveRepoPath(
    "data",
    "derived",
    "europe-settlements-overlay.svg"
  );
  const outputPngPath = resolveRepoPath(
    "data",
    "derived",
    "europe-settlements-overlay.png"
  );
  const outputJsonPath = resolveRepoPath(
    "data",
    "derived",
    "europe-settlements.json"
  );

  if (!(await fileExists(rawTextPath))) {
    throw new Error(
      "Missing GeoNames text dump. Unzip `cities500.zip` into `data/raw/geonames/` first."
    );
  }

  const fileContents = await fs.readFile(rawTextPath, "utf8");
  const settlements = fileContents
    .split(/\r?\n/)
    .map(parseGeoNamesLine)
    .filter((record): record is GeoNamesRecord => Boolean(record))
    .filter((record) =>
      isInsideBounds(
        {
          longitude: record.longitude,
          latitude: record.latitude
        },
        EUROPE_AUTHORING_PROJECTION.bounds
      )
    )
    .sort((left, right) => scoreSettlement(right) - scoreSettlement(left))
    .slice(0, 600);

  const svgParts = [getSvgHeader(EUROPE_AUTHORING_PROJECTION)];

  for (const settlement of settlements) {
    const point = projectLonLat(
      {
        longitude: settlement.longitude,
        latitude: settlement.latitude
      },
      EUROPE_AUTHORING_PROJECTION
    );
    const label = pickLabel(settlement).replaceAll("&", "&amp;");
    const fontSize = settlement.population > 250_000 ? 22 : 16;
    const radius = settlement.population > 250_000 ? 3.5 : 2;

    svgParts.push(
      `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${radius}" fill="#7f1111" />`
    );
    svgParts.push(
      `<text x="${(point.x + 6).toFixed(2)}" y="${(point.y - 4).toFixed(2)}" font-size="${fontSize}" font-family="Georgia, serif" fill="#241811">${label}</text>`
    );
  }

  svgParts.push(getSvgFooter());
  const svgContent = svgParts.join("\n");
  await writeSvgAndPng(svgContent, outputPath, outputPngPath);
  await fs.writeFile(
    outputJsonPath,
    JSON.stringify(
      settlements.map((settlement) => ({
        id: settlement.geonameId,
        name: pickLabel(settlement),
        countryCode: settlement.countryCode,
        coordinates: {
          longitude: settlement.longitude,
          latitude: settlement.latitude
        },
        population: settlement.population
      })),
      null,
      2
    ),
    "utf8"
  );
  console.log(`Wrote ${path.basename(outputPath)}`);
  console.log(`Wrote ${path.basename(outputPngPath)}`);
  console.log(`Wrote ${path.basename(outputJsonPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
