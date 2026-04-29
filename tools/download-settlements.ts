import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, resolveRepoPath } from "./lib/nodeUtils.js";

const URL = "https://download.geonames.org/export/dump/cities500.zip";
const FILE_NAME = "cities500.zip";

async function main() {
  const outputDirectory = resolveRepoPath("data", "raw", "geonames");
  await ensureDirectory(outputDirectory);
  const destination = path.join(outputDirectory, FILE_NAME);

  console.log(`Downloading ${URL}`);
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to download ${URL}: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, bytes);
  console.log(`Saved ${destination}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
