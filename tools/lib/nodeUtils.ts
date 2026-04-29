import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function ensureDirectory(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveRepoPath(...parts: string[]) {
  return path.resolve(process.cwd(), ...parts);
}

export async function writeSvgAndPng(
  svgContent: string,
  svgPath: string,
  pngPath: string
) {
  await fs.writeFile(svgPath, svgContent, "utf8");
  await sharp(Buffer.from(svgContent, "utf8")).png().toFile(pngPath);
}
