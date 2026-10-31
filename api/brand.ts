/**
 * Brand assets shared by the PDFs and the HTML emails — logo, van banner
 * and the blue palette from the site's theme tokens (mint/forest are blue).
 * Images are read from src/assets at runtime (the Dockerfile copies the
 * whole project) and cached in memory.
 */
import fs from "node:fs";
import path from "node:path";

export const BRAND = {
  blue: "#1E66B8", // forest token — headings, rules
  bright: "#1A6FD1", // mint token — accents
  light: "#E4EFFB", // mintlight token — soft fills
  charcoal: "#1F2421", // body text
  grey: "#5B6560", // secondary text
} as const;

const cache: Partial<Record<"logo" | "van", Buffer>> = {};

function readAsset(file: string): Buffer {
  const candidates = [
    path.resolve(process.cwd(), "src/assets", file),
    path.resolve(process.cwd(), "../src/assets", file),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  throw new Error(`Brand asset not found: ${file}`);
}

export function brandLogo(): Buffer {
  if (!cache.logo) cache.logo = readAsset("logo-brand.png");
  return cache.logo;
}

export function brandVan(): Buffer {
  if (!cache.van) cache.van = readAsset("van-banner.jpg");
  return cache.van;
}
