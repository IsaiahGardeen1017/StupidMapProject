import { EUROPE_AUTHORING_PROJECTION, getSvgFooter, getSvgHeader } from "./lib/mapPipeline.js";
import { coordinatesToPath, featureToPaths, loadFeatureCollection } from "./lib/overlayRender.js";
import { fileExists, resolveRepoPath, writeSvgAndPng } from "./lib/nodeUtils.js";

async function main() {
  const bordersZipPath = resolveRepoPath("data", "raw", "natural-earth", "ne_10m_admin_0_boundary_lines_land.zip");
  const outputPath = resolveRepoPath("data", "derived", "europe-modern-borders-overlay.svg");
  const outputPngPath = resolveRepoPath("data", "derived", "europe-modern-borders-overlay.png");

  if (!(await fileExists(bordersZipPath))) {
    throw new Error("Missing Natural Earth admin-0 border source file. Run `npm run tool:download-basemap` first.");
  }

  const borderCollection = await loadFeatureCollection(bordersZipPath);
  const svgParts = [getSvgHeader(EUROPE_AUTHORING_PROJECTION)];

  for (const feature of borderCollection.features) {
    for (const line of featureToPaths(feature)) {
      const d = coordinatesToPath(line[0], EUROPE_AUTHORING_PROJECTION);
      if (!d) {
        continue;
      }

      svgParts.push(`<path d="${d}" fill="none" stroke="#5b1624" stroke-width="1.15" />`);
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
