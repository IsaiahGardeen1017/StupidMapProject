import { EUROPE_AUTHORING_PROJECTION, getSvgFooter, getSvgHeader } from "./lib/mapPipeline.js";
import { coordinatesToPath, featureToPaths, loadFeatureCollection } from "./lib/overlayRender.js";
import { fileExists, resolveRepoPath, writeSvgAndPng } from "./lib/nodeUtils.js";

async function main() {
  const riversZipPath = resolveRepoPath("data", "raw", "natural-earth", "ne_10m_rivers_lake_centerlines.zip");
  const outputPath = resolveRepoPath("data", "derived", "europe-rivers-overlay.svg");
  const outputPngPath = resolveRepoPath("data", "derived", "europe-rivers-overlay.png");

  if (!(await fileExists(riversZipPath))) {
    throw new Error("Missing Natural Earth rivers source file. Run `npm run tool:download-basemap` first.");
  }

  const riversCollection = await loadFeatureCollection(riversZipPath);
  const svgParts = [getSvgHeader(EUROPE_AUTHORING_PROJECTION)];

  for (const feature of riversCollection.features) {
    for (const line of featureToPaths(feature)) {
      const d = coordinatesToPath(line[0], EUROPE_AUTHORING_PROJECTION);
      if (!d) {
        continue;
      }

      svgParts.push(`<path d="${d}" fill="none" stroke="#2a5f8f" stroke-width="1.2" />`);
    }
  }

  svgParts.push(getSvgFooter());
  await writeSvgAndPng(svgParts.join("\n"), outputPath, outputPngPath);
  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${outputPngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
