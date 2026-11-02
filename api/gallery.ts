// Before/after job photos — the trust gallery on /work. Photos are stored in
// the database itself (settings keys), not on disk: the site runs on hosts
// with an ephemeral filesystem, and the DB keeps the images backed up and
// portable. Uploaded from Admin → Settings as resized JPEG data URLs;
// anything over 5 MB a side is refused.
import { getSetting, setSetting, deleteSetting } from "./queries/settings";

const GALLERY_KEY = "gallery_items";
const IMG_PREFIX = "gallery_img:";
const MAX_BYTES = 5 * 1024 * 1024;

export interface GalleryItem {
  id: string;
  caption: string;
  suburb: string;
  before: string; // served filename: <id>-before.jpg
  after: string; // "" = single "finished job" photo (no compare slider)
  createdAt: string; // ISO
}

export async function listGallery(): Promise<GalleryItem[]> {
  const raw = await getSetting(GALLERY_KEY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as GalleryItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function decodeDataUrl(dataUrl: string): { bytes: number; ext: string } {
  const m = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("Photos need to be JPEG or PNG images.");
  const bytes = Buffer.from(m[2], "base64").length;
  if (bytes === 0) throw new Error("That photo came through empty — try exporting it again.");
  if (bytes > MAX_BYTES) throw new Error("That photo is over 5 MB — resize it down and try again.");
  return { bytes, ext: m[1] === "png" ? "png" : "jpg" };
}

export async function addGalleryItem(input: {
  caption: string;
  suburb: string;
  beforeDataUrl: string;
  afterDataUrl?: string; // omit for a single "finished job" photo
}): Promise<GalleryItem> {
  decodeDataUrl(input.beforeDataUrl);
  if (input.afterDataUrl) decodeDataUrl(input.afterDataUrl);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const item: GalleryItem = {
    id,
    caption: input.caption.trim().slice(0, 120),
    suburb: input.suburb.trim().slice(0, 60),
    before: `${id}-before.jpg`,
    after: input.afterDataUrl ? `${id}-after.jpg` : "",
    createdAt: new Date().toISOString(),
  };
  await setSetting(`${IMG_PREFIX}${id}:before`, input.beforeDataUrl.trim());
  if (input.afterDataUrl) await setSetting(`${IMG_PREFIX}${id}:after`, input.afterDataUrl.trim());
  const items = await listGallery();
  items.unshift(item); // newest first
  await setSetting(GALLERY_KEY, JSON.stringify(items));
  return item;
}

export async function removeGalleryItem(id: string): Promise<void> {
  const items = await listGallery();
  const rest = items.filter((x) => x.id !== id);
  await setSetting(GALLERY_KEY, JSON.stringify(rest));
  await deleteSetting(`${IMG_PREFIX}${id}:before`);
  await deleteSetting(`${IMG_PREFIX}${id}:after`);
}

/** Serve an uploaded photo by its public filename (<id>-<side>.jpg). */
export async function getGalleryImage(
  file: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  const m = /^([a-z0-9-]+)-(before|after)\.(jpg|jpeg|png)$/.exec(file);
  if (!m) return null;
  const dataUrl = await getSetting(`${IMG_PREFIX}${m[1]}:${m[2]}`);
  if (!dataUrl) return null;
  const parts = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
  if (!parts) return null;
  return { buf: Buffer.from(parts[2], "base64"), contentType: parts[1] };
}
