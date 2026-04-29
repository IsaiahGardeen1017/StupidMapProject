import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, resolveRepoPath } from "./lib/nodeUtils.js";

type DownloadTarget = {
  url: string;
  fileName: string;
};

const DOWNLOADS: DownloadTarget[] = [
  {
    url: "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_land.zip",
    fileName: "ne_10m_land.zip"
  },
  {
    url: "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_coastline.zip",
    fileName: "ne_10m_coastline.zip"
  },
  {
    url: "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_lakes.zip",
    fileName: "ne_10m_lakes.zip"
  },
  {
    url: "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_regions_points.zip",
    fileName: "ne_10m_geography_regions_points.zip"
  }
];

async function downloadFile(target: DownloadTarget, outputDirectory: string) {
  const destination = path.join(outputDirectory, target.fileName);
  console.log(`Downloading ${target.url}`);

  const response = await fetch(target.url);
  if (!response.ok) {
    throw new Error(`Failed to download ${target.url}: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, bytes);
  console.log(`Saved ${destination}`);
}

async function main() {
  const outputDirectory = resolveRepoPath("data", "raw", "natural-earth");
  await ensureDirectory(outputDirectory);

  for (const target of DOWNLOADS) {
    await downloadFile(target, outputDirectory);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
