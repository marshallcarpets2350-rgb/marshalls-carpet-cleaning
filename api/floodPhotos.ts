// Flood-job photo evidence (16 Nov 2026, Ben: "photo uploads of work done").
// Before/after and work-in-progress shots are stored against the flood lead
// so they're on the job forever, and they're embedded at the end of the
// insurer-ready report PDF — photos are what make an assessor sign off.
//
// Same storage pattern as work orders and the gallery: data URLs in the
// settings table (the host filesystem is ephemeral). The lead row only
// carries the count, so admin lists stay light; photos load on demand,
// admin-only.
import { deleteSetting, getSetting, setSetting } from "./queries/settings";

const KEY_PREFIX = "flood_photos:";
const MAX_BYTES = 5 * 1024 * 1024;
export const FLOOD_PHOTO_CAP = 12;

export interface FloodPhoto {
  fileName: string;
  dataUrl: string;
}

function keyFor(leadId: number): string {
  return `${KEY_PREFIX}${leadId}`;
}

/** Photos only (JPEG/PNG) — the report PDF embeds them, so no PDFs here. */
function decodePhotoDataUrl(dataUrl: string): void {
  const m = /^data:(image\/jpeg|image\/jpg|image\/png);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("Photos need to be a JPEG or PNG image.");
  const bytes = Buffer.from(m[2].replace(/\s/g, ""), "base64").length;
  if (bytes === 0) throw new Error("That photo came through empty — try saving it again.");
  if (bytes > MAX_BYTES) throw new Error("That photo is over 5 MB — send yourself a smaller copy and try again.");
}

export async function getFloodPhotos(leadId: number): Promise<FloodPhoto[]> {
  const raw = await getSetting(keyFor(leadId));
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as FloodPhoto[];
    if (!Array.isArray(list)) return [];
    return list.filter((p) => typeof p?.fileName === "string" && typeof p?.dataUrl === "string");
  } catch {
    return [];
  }
}

export async function addFloodPhoto(leadId: number, fileName: string, dataUrl: string): Promise<number> {
  decodePhotoDataUrl(dataUrl);
  const list = await getFloodPhotos(leadId);
  if (list.length >= FLOOD_PHOTO_CAP) {
    throw new Error(`${FLOOD_PHOTO_CAP} photos is plenty for one job — delete one first.`);
  }
  const clean = (fileName.trim() || `photo-${list.length + 1}`).slice(0, 120);
  list.push({ fileName: clean, dataUrl: dataUrl.trim() });
  await setSetting(keyFor(leadId), JSON.stringify(list));
  return list.length;
}

export async function removeFloodPhoto(leadId: number, index: number): Promise<number> {
  const list = await getFloodPhotos(leadId);
  if (index < 0 || index >= list.length) throw new Error("That photo is already gone.");
  list.splice(index, 1);
  if (list.length === 0) await deleteSetting(keyFor(leadId));
  else await setSetting(keyFor(leadId), JSON.stringify(list));
  return list.length;
}
