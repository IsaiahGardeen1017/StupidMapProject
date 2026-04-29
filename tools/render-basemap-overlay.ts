import { EUROPE_AUTHORING_PROJECTION, getSvgFooter, getSvgHeader } from "./lib/mapPipeline.js";
import { coordinatesToPath, featureToPaths, loadFeatureCollection } from "./lib/overlayRender.js";
import { fileExists, resolveRepoPath, writeSvgAndPng } from "./lib/nodeUtils.js";

async function main() {
    const landZipPath = resolveRepoPath(
        "data",
        "raw",
        "natural-earth",
        "ne_10m_land.zip",
    );
    const coastlineZipPath = resolveRepoPath(
        "data",
        "raw",
        "natural-earth",
        "ne_10m_coastline.zip",
    );
    const outputPath = resolveRepoPath(
        "data",
        "derived",
        "europe-basemap-overlay.svg",
    );
    const outputPngPath = resolveRepoPath(
        "data",
        "derived",
        "europe-basemap-overlay.png",
    );

    if (
        !(await fileExists(landZipPath)) ||
        !(await fileExists(coastlineZipPath))
    ) {
        throw new Error(
            "Missing Natural Earth source files. Run `npm run tool:download-basemap` first.",
        );
    }

    const [landCollection, coastlineCollection] = await Promise.all([
        loadFeatureCollection(landZipPath),
        loadFeatureCollection(coastlineZipPath),
    ]);

    const svgParts = [getSvgHeader(EUROPE_AUTHORING_PROJECTION, "#d4ccb5")];

    for (const feature of landCollection.features) {
        for (const polygon of featureToPaths(feature)) {
            const exterior = coordinatesToPath(polygon[0], EUROPE_AUTHORING_PROJECTION);
            if (!exterior) {
                continue;
            }

            svgParts.push(
                `<path d="${exterior} Z" fill="#f7f2e4" stroke="#c1b28c" stroke-width="0.75" />`,
            );
        }
    }

    for (const feature of coastlineCollection.features) {
        for (const line of featureToPaths(feature)) {
            const d = coordinatesToPath(line[0], EUROPE_AUTHORING_PROJECTION);
            if (!d) {
                continue;
            }

            svgParts.push(
                `<path d="${d}" fill="none" stroke="#6b604f" stroke-width="1.25" />`,
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
