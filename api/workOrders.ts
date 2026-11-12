// Agency work-order documents (12 Nov 2026, Ben: "maybe we also have a work
// order upload document"). Real estates (PropertyTree etc.) issue a work
// order per job — the PDF/screenshot is stored against the lead so Ben can
// pull it up on site, and the work-order NUMBER prints on the invoice so
// the agency accounts team can match the payment.
//
// Documents are stored in the settings table as data URLs (same pattern as
// the gallery — the host filesystem is ephemeral, the DB keeps them backed
// up). Only the file NAME rides in booking_json.workOrderDoc so the admin
// jobs list stays light; the data URL is fetched on demand, admin-only.
import { deleteSetting, getSetting, setSetting } from "./queries/settings";

const KEY_PREFIX = "workorder_doc:";
const MAX_BYTES = 5 * 1024 * 1024;

export interface WorkOrderDoc {
  fileName: string;
  dataUrl: string;
}

function keyFor(leadId: number): string {
  return `${KEY_PREFIX}${leadId}`;
}

/** Validate + normalise an uploaded work-order document. Images (JPEG/PNG)
 *  and PDFs only, 5 MB raw cap — same ceiling as gallery photos. */
function decodeDocDataUrl(dataUrl: string): void {
  const m = /^data:(image\/jpeg|image\/jpg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl.trim(),
  );
  if (!m) throw new Error("Work orders need to be a photo (JPEG/PNG) or a PDF.");
  const bytes = Buffer.from(m[2].replace(/\s/g, ""), "base64").length;
  if (bytes === 0) throw new Error("That file came through empty — try saving it again.");
  if (bytes > MAX_BYTES) throw new Error("That file is over 5 MB — send yourself a smaller copy and try again.");
}

export async function saveWorkOrderDoc(leadId: number, fileName: string, dataUrl: string): Promise<string> {
  decodeDocDataUrl(dataUrl);
  const clean = (fileName.trim() || "work-order").slice(0, 120);
  const doc: WorkOrderDoc = { fileName: clean, dataUrl: dataUrl.trim() };
  await setSetting(keyFor(leadId), JSON.stringify(doc));
  return clean;
}

export async function getWorkOrderDoc(leadId: number): Promise<WorkOrderDoc | null> {
  const raw = await getSetting(keyFor(leadId));
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as WorkOrderDoc;
    if (typeof doc.fileName !== "string" || typeof doc.dataUrl !== "string") return null;
    return doc;
  } catch {
    return null;
  }
}

export async function removeWorkOrderDoc(leadId: number): Promise<void> {
  await deleteSetting(keyFor(leadId));
}
