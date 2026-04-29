import { EUROPE_AUTHORING_PROJECTION, getSvgFooter, getSvgHeader } from "./lib/mapPipeline.js";
import { coordinatesToPath, featureToPaths, loadFeatureCollection } from "./lib/overlayRender.js";
import { fileExists, resolveRepoPath, writeSvgAndPng } from "./lib/nodeUtils.js";

async function main() {
  const admin1ZipPath = resolveRepoPath("data", "raw", "natural-earth", "ne_10m_admin_1_states_provinces_lines.zip");
  const outputPath = resolveRepoPath("data", "derived", "europe-admin1-borders-overlay.svg");
  const outputPngPath = resolveRepoPath("data", "derived", "europe-admin1-borders-overlay.png");

  if (!(await fileExists(admin1ZipPath))) {
    throw new Error("Missing Natural Earth admin-1 border source file. Run `npm run tool:download-basemap` first.");
  }

  const admin1Collection = await loadFeatureCollection(admin1ZipPath);
  const svgParts = [getSvgHeader(EUROPE_AUTHORING_PROJECTION)];

  for (const feature of admin1Collection.features) {
    for (const line of featureToPaths(feature)) {
      const d = coordinatesToPath(line[0], EUROPE_AUTHORING_PROJECTION);
      if (!d) {
        continue;
      }

      svgParts.push(`<path d="${d}" fill="none" stroke="#8f6c2b" stroke-width="0.9" stroke-dasharray="3 2" />`);
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
