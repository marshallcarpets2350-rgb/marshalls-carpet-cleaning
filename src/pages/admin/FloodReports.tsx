/**
 * Flood job reports — pick a flood emergency job, log technicians, hours
 * (standard / after-hours) and drying fans, write the report, and it's
 * priced off the published flood rates. Save stores it on the job; the
 * email button sends the insurer-ready PDF to the customer.
 */
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { trpc } from "@/providers/trpc";
import { floodReportCharges, money, type FloodPrices } from "@contracts/rates";

interface LeadRowLike {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  suburb: string | null;
  total: number;
  status: string;
  createdAt: string | Date;
  quoteJson: string;
  workOrderNumber?: string | null;
  workOrderDoc?: string | null;
}

interface FloodRequestLike {
  cause: string;
  rooms: string;
  activeLeak: string;
  insurance: string;
  notes?: string;
}

function isFloodLead(l: LeadRowLike): boolean {
  try {
    return Boolean((JSON.parse(l.quoteJson) as { flood?: unknown }).flood);
  } catch {
    return false;
  }
}

function reportOf(l: LeadRowLike): { savedAt: string; emailedAt?: string } | null {
  try {
    return (JSON.parse(l.quoteJson) as { floodReport?: { savedAt: string; emailedAt?: string } }).floodReport ?? null;
  } catch {
    return null;
  }
}

const ref = (id: number) => `MCC-${String(id).padStart(4, "0")}`;
const todayIso = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd

/** The editable fields, lifted off a stored report for dirty-checking. */
function snapshotOf(r: ReportFields): ReportFields {
  return {
    attendedAt: r.attendedAt,
    technicians: r.technicians,
    standardHours: r.standardHours,
    afterHoursHours: r.afterHoursHours,
    saturdayHours: r.saturdayHours,
    sundayHours: r.sundayHours,
    travelKm: r.travelKm,
    travelHours: r.travelHours,
    adminCharged: r.adminCharged,
    reportCharged: r.reportCharged,
    fans: r.fans,
    fanDays: r.fanDays,
    inspectionCharged: r.inspectionCharged,
    returnCleanM2: r.returnCleanM2,
    antimicroAreas: r.antimicroAreas,
    summary: r.summary,
    workDone: r.workDone,
    readings: r.readings,
    insurerNotes: r.insurerNotes,
  };
}

const inputCls = "input-sharp";
const labelCls = "mb-1 block text-sm font-bold text-charcoal";

export default function FloodReports() {
  const leads = trpc.admin.listLeads.useQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  const floodLeads = useMemo(
    () => ((leads.data ?? []) as LeadRowLike[]).filter(isFloodLead),
    [leads.data],
  );

  if (selected !== null) {
    return <ReportEditor id={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-black text-charcoal">Flood job reports</h2>
        <button type="button" className="btn-pill" onClick={() => setShowNew((s) => !s)}>
          {showNew ? "Cancel" : "+ New flood job (they called you)"}
        </button>
      </div>
      <p className="mt-1 text-sm text-charcoal/70">
        Log hours and fans after a flood callout — the report prices itself at
        the published rates and emails to the customer as an insurer-ready PDF.
      </p>
      {showNew && (
        <NewFloodJob
          onCreated={(id) => {
            setShowNew(false);
            setSelected(id);
          }}
        />
      )}
      <div className="mt-6 space-y-3">
        {floodLeads.length === 0 && (
          <p className="border-[1.5px] border-charcoal bg-background p-6 text-charcoal/70">
            No flood emergencies yet. When one comes in from the flood page it
            lands here — or tap "+ New flood job" when someone rings you.
          </p>
        )}
        {floodLeads.map((l) => {
          const rep = reportOf(l);
          return (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-charcoal bg-background p-4"
            >
              <div>
                <p className="font-bold text-charcoal">
                  {ref(l.id)} — {l.name}
                  <span className="ml-2 text-sm font-normal text-charcoal/60">
                    {[l.suburb, l.address].filter(Boolean).join(", ")}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-charcoal/60">
                  {new Date(l.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  {" · "}{money(l.total)}{" · "}
                  {rep
                    ? rep.emailedAt
                      ? `Report emailed ${new Date(rep.emailedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                      : "Report saved — not emailed yet"
                    : "No report yet"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <DeleteFloodJob id={l.id} name={l.name} />
                <button type="button" className="btn-pill" onClick={() => setSelected(l.id)}>
                  {rep ? "Open report" : "Write report"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Customer rang instead of using the website — Ben types it in and it
 *  becomes a normal flood job, ready for the report after the callout. */
function NewFloodJob({ onCreated }: { onCreated: (id: number) => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [notes, setNotes] = useState("");

  const create = trpc.admin.createFloodLead.useMutation({
    onSuccess: async (r) => {
      await utils.admin.listLeads.invalidate();
      onCreated(r.id);
    },
  });

  const valid = name.trim().length > 0 && phone.trim().length >= 6 && address.trim().length >= 3;

  return (
    <form
      className="mt-4 space-y-4 border-[1.5px] border-charcoal bg-creamlight p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || create.isPending) return;
        create.mutate({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || "",
          address: address.trim(),
          suburb: suburb.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <p className="font-bold text-charcoal">New flood job — phoned in</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nf-name" className={labelCls}>Name</label>
          <input id="nf-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nf-phone" className={labelCls}>Phone</label>
          <input id="nf-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nf-address" className={labelCls}>Address</label>
          <input id="nf-address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nf-suburb" className={labelCls}>Suburb / town</label>
          <input id="nf-suburb" className={inputCls} value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Armidale" />
        </div>
      </div>
      <div>
        <label htmlFor="nf-email" className={labelCls}>Email (optional — needed if you'll email them the report)</label>
        <input id="nf-email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      </div>
      <div>
        <label htmlFor="nf-notes" className={labelCls}>What they said (optional)</label>
        <textarea id="nf-notes" className={`${inputCls} min-h-16`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Burst hose in the laundry, water into the hallway…" />
      </div>
      {create.isError && <p className="text-sm font-semibold text-destructive">{create.error.message}</p>}
      <button type="submit" disabled={!valid || create.isPending} className="btn-pill disabled:cursor-not-allowed disabled:opacity-40">
        {create.isPending ? "Creating…" : "Create job & open the report"}
      </button>
    </form>
  );
}

/** Delete a flood job (mistakes, double-ups, cancelled callouts). Confirms
 *  first — this removes the booking entirely, not just the report. */
function DeleteFloodJob({ id, name, onDeleted }: { id: number; name: string; onDeleted?: () => void }) {
  const utils = trpc.useUtils();
  const del = trpc.admin.deleteLead.useMutation({
    onSuccess: async () => {
      await utils.admin.listLeads.invalidate();
      onDeleted?.();
    },
  });
  return (
    <button
      type="button"
      className="text-sm font-bold text-destructive underline disabled:opacity-40"
      disabled={del.isPending}
      onClick={() => {
        if (window.confirm(`Delete ${ref(id)} — ${name}? The job and its report are gone for good.`)) {
          del.mutate({ id });
        }
      }}
    >
      {del.isPending ? "Deleting…" : "Delete job"}
    </button>
  );
}

/** Resize helper for uploads (same as the gallery/work-order one in
 *  Admin.tsx — max side 1200px, JPEG 0.82). */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

/** Open a stored data-URL document in a new tab (blob URL, so the browser
 *  doesn't choke on a giant address bar). */
function openDataUrl(dataUrl: string): boolean {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return false;
  const bin = atob(m[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  window.open(URL.createObjectURL(new Blob([bytes], { type: m[1] })), "_blank");
  return true;
}

/** Real-estate work order on a flood job (16 Nov 2026, Ben: "input work
 *  orders from Realastate… a screenshot of work order and information"):
 *  the agency's work-order NUMBER (prints on the invoice automatically) and
 *  the work-order screenshot/PDF itself, stored against the job so it can be
 *  pulled up on site. Same storage as regular jobs. Module-level with its
 *  own subscriptions — the OwingBadge rule. */
function FloodWorkOrder({ id, number, doc }: { id: number; number?: string | null; doc?: string | null }) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => utils.admin.floodReportData.invalidate({ id });
  const saveNum = trpc.admin.setWorkOrderNumber.useMutation({
    onSuccess: async () => { setEditing(false); setErr(""); await refresh(); },
    onError: (e) => setErr(e.message),
  });
  const upload = trpc.admin.uploadWorkOrderDoc.useMutation({
    onSuccess: async () => { setErr(""); await refresh(); },
    onError: (e) => setErr(e.message),
  });
  const remove = trpc.admin.removeWorkOrderDoc.useMutation({
    onSuccess: async () => { setErr(""); await refresh(); },
    onError: (e) => setErr(e.message),
  });
  const current = number?.trim() || "";

  const openDoc = async () => {
    setErr("");
    setBusy(true);
    try {
      const d = await utils.admin.getWorkOrderDoc.fetch({ id });
      if (!d || !openDataUrl(d.dataUrl)) setErr("Couldn't open that document — try uploading it again.");
    } catch {
      setErr("Couldn't open that document — try again.");
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try {
      let dataUrl: string;
      if (file.type === "application/pdf") {
        if (file.size > 5 * 1024 * 1024) {
          setErr("That PDF is over 5 MB — send yourself a smaller copy.");
          return;
        }
        dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("unreadable"));
          fr.readAsDataURL(file);
        });
      } else {
        dataUrl = await resizeImage(file);
      }
      upload.mutate({ id, fileName: file.name, dataUrl });
    } catch {
      setErr("Couldn't read that file — use a photo (JPEG/PNG) or a PDF.");
    }
  };

  return (
    <div className="border-[1.5px] border-charcoal bg-creamlight p-4">
      <p className="font-bold text-charcoal">Work order from the real estate</p>
      <p className="mt-0.5 text-xs text-charcoal/60">
        The agency's work-order number prints on the invoice so their accounts
        team can match the payment; the screenshot or PDF stays on the job.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 8017a-4358"
              className="w-44 max-w-full border-[1.5px] border-charcoal/40 bg-white px-2 py-1.5 text-sm"
            />
            <button type="button" className="btn-pill !px-3 !py-1 text-xs" disabled={saveNum.isPending}
              onClick={() => saveNum.mutate({ id, number: text })}>
              {saveNum.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="text-xs text-charcoal/50 underline" onClick={() => setEditing(false)}>cancel</button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-charcoal">
              No. {current || <span className="font-normal text-charcoal/50">not set</span>}
            </span>
            <button type="button" className="text-xs font-bold text-forest underline"
              onClick={() => { setText(current); setEditing(true); }}>
              {current ? "change" : "add number"}
            </button>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {doc ? (
          <>
            <button type="button" className="text-sm font-bold text-forest underline disabled:opacity-40" disabled={busy} onClick={openDoc}>
              {busy ? "Opening…" : `View ${doc}`}
            </button>
            <button type="button" className="text-xs text-charcoal/50 underline" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              replace
            </button>
            <button type="button" className="text-xs font-semibold text-destructive underline" disabled={remove.isPending}
              onClick={() => { if (window.confirm("Remove the work-order document?")) remove.mutate({ id }); }}>
              remove
            </button>
          </>
        ) : (
          <button type="button" className="btn-pill !px-3 !py-1 text-xs" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            {upload.isPending ? "Uploading…" : "Upload work order (screenshot or PDF)"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={pickFile} />
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
    </div>
  );
}

/** Photos of the work on a flood job (16 Nov 2026, Ben) — before/after and
 *  drying-setup shots, stored on the job and embedded at the end of the
 *  insurer PDF when the report is emailed. Up to 12, JPEG/PNG. Module-level
 *  with its own query — the OwingBadge rule. */
function FloodPhotos({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const photos = trpc.admin.floodPhotos.useQuery({ id });
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    await photos.refetch();
    await utils.admin.floodReportData.invalidate({ id });
  };
  const add = trpc.admin.addFloodPhoto.useMutation();
  const remove = trpc.admin.removeFloodPhoto.useMutation({
    onSuccess: refresh,
    onError: (e) => setErr(e.message),
  });
  const list = photos.data ?? [];

  const pickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setErr("");
    setBusy(true);
    try {
      for (const file of files) {
        const dataUrl = await resizeImage(file);
        await add.mutateAsync({ id, fileName: file.name, dataUrl });
      }
      await refresh();
    } catch (err2) {
      setErr(err2 instanceof Error ? err2.message : "Couldn't save that photo — use a JPEG or PNG.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-[1.5px] border-charcoal bg-creamlight p-4">
      <p className="font-bold text-charcoal">Photos of the work</p>
      <p className="mt-0.5 text-xs text-charcoal/60">
        Before/after and the drying setup — they're embedded at the end of the
        insurer PDF, so shoot wide and clear. {list.length}/12 stored.
      </p>
      {list.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.map((p, i) => (
            <div key={`${p.fileName}-${i}`} className="relative border border-charcoal/30 bg-white">
              <button
                type="button"
                className="block w-full"
                title={`Open photo ${i + 1}`}
                onClick={() => { if (!openDataUrl(p.dataUrl)) setErr("Couldn't open that photo — upload it again."); }}
              >
                <img src={p.dataUrl} alt={`Job photo ${i + 1}`} className="h-20 w-full object-cover" />
              </button>
              <button
                type="button"
                className="absolute right-0.5 top-0.5 bg-charcoal/80 px-1.5 text-xs font-bold text-white"
                title="Delete this photo"
                disabled={remove.isPending}
                onClick={() => { if (window.confirm(`Delete photo ${i + 1}?`)) remove.mutate({ id, index: i }); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <button type="button" className="btn-pill !px-3 !py-1 text-xs disabled:opacity-40" disabled={busy || list.length >= 12} onClick={() => fileRef.current?.click()}>
          {busy ? "Uploading…" : "+ Add photos"}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={pickFiles} />
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
    </div>
  );
}

function ReportEditor({ id, onBack }: { id: number; onBack: () => void }) {  const data = trpc.admin.floodReportData.useQuery({ id });
  if (data.isLoading) return <p className="text-charcoal/70">Loading…</p>;
  if (!data.data) return <p className="text-destructive">Couldn't load this job.</p>;
  const key = `${id}-${data.data.report?.savedAt ?? "new"}`;
  return <ReportForm key={key} data={data.data} onBack={onBack} />;
}

function ReportForm({
  data,
  onBack,
}: {
  data: {
    lead: LeadRowLike;
    flood: FloodRequestLike | null;
    report: (ReportFields & { savedAt: string; emailedAt?: string }) | null;
    prices: FloodPrices;
  };
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const r = data.report;
  const [attendedAt, setAttendedAt] = useState(r?.attendedAt ?? todayIso());
  const [technicians, setTechnicians] = useState(r?.technicians ?? 1);
  const [standardHours, setStandardHours] = useState(r?.standardHours ?? 0);
  const [afterHoursHours, setAfterHoursHours] = useState(r?.afterHoursHours ?? 0);
  const [saturdayHours, setSaturdayHours] = useState(r?.saturdayHours ?? 0);
  const [sundayHours, setSundayHours] = useState(r?.sundayHours ?? 0);
  const [travelKm, setTravelKm] = useState(r?.travelKm ?? 0);
  const [travelHours, setTravelHours] = useState(r?.travelHours ?? 0);
  const [adminCharged, setAdminCharged] = useState(r?.adminCharged ?? false);
  const [reportCharged, setReportCharged] = useState(r?.reportCharged ?? true);
  const [fans, setFans] = useState(r?.fans ?? 0);
  const [fanDays, setFanDays] = useState(r?.fanDays ?? 1);
  const [inspectionCharged, setInspectionCharged] = useState(r?.inspectionCharged ?? true);
  const [returnCleanM2, setReturnCleanM2] = useState(r?.returnCleanM2 ?? 0);
  const [antimicroAreas, setAntimicroAreas] = useState(r?.antimicroAreas ?? 0);
  const [summary, setSummary] = useState(r?.summary ?? "");
  const [workDone, setWorkDone] = useState(r?.workDone ?? "");
  const [readings, setReadings] = useState(r?.readings ?? "");
  const [insurerNotes, setInsurerNotes] = useState(r?.insurerNotes ?? "");
  // The version the PDF email sends is always the last SAVED one.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(r ? JSON.stringify(snapshotOf(r)) : null);

  const fields: ReportFields = {
    attendedAt, technicians, standardHours, afterHoursHours,
    saturdayHours, sundayHours, travelKm, travelHours, adminCharged, reportCharged,
    fans, fanDays, inspectionCharged, returnCleanM2, antimicroAreas, summary, workDone, readings, insurerNotes,
  };
  const { lines, total } = floodReportCharges(fields, data.prices);
  const dirty = JSON.stringify(fields) !== savedSnapshot;
  const hasSaved = savedSnapshot !== null;

  const save = trpc.admin.saveFloodReport.useMutation({
    onSuccess: async () => {
      setSavedSnapshot(JSON.stringify(fields));
      await utils.admin.listLeads.invalidate();
    },
  });
  const email = trpc.admin.emailFloodReport.useMutation({
    onSuccess: () => utils.admin.floodReportData.invalidate({ id: data.lead.id }),
  });
  const invoice = trpc.admin.sendInvoice.useMutation();

  const num = (v: number) => (Number.isFinite(v) ? v : 0);
  const canEmail = hasSaved && !dirty && Boolean(data.lead.email);

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm font-bold text-forest">
        ← All flood jobs
      </button>
      <h2 className="mt-2 font-display text-2xl font-black text-charcoal">
        {ref(data.lead.id)} — {data.lead.name}
      </h2>
      <p className="mt-1 text-sm text-charcoal/70">
        {[data.lead.address, data.lead.suburb].filter(Boolean).join(", ")}
        {" · "}{data.lead.phone}
        {data.lead.email ? ` · ${data.lead.email}` : " · no email on file"}
      </p>

      {data.flood && (
        <div className="mt-4 border-[1.5px] border-charcoal bg-background p-4 text-sm">
          <p className="font-bold text-charcoal">Their emergency request</p>
          <p className="mt-1 text-charcoal/75">
            {data.flood.cause} · {data.flood.rooms} · leak on arrival: {data.flood.activeLeak.toLowerCase()} ·
            insurance: {data.flood.insurance.toLowerCase()}
          </p>
          {data.flood.notes && <p className="mt-1 text-charcoal/60">“{data.flood.notes}”</p>}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── the form ── */}
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="fr-date" className={labelCls}>Date attended</label>
              <input id="fr-date" type="date" className={inputCls} value={attendedAt} onChange={(e) => setAttendedAt(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fr-techs" className={labelCls}>Technicians</label>
              <input id="fr-techs" type="number" min={1} max={6} className={inputCls} value={technicians} onChange={(e) => setTechnicians(Math.max(1, Math.round(num(e.target.valueAsNumber))))} />
            </div>
            <div>
              <span className={labelCls}>Inspection</span>
              <label className="flex items-center gap-2 border-[1.5px] border-charcoal bg-background px-3 py-2.5 text-sm font-semibold text-charcoal">
                <input type="checkbox" checked={inspectionCharged} onChange={(e) => setInspectionCharged(e.target.checked)} />
                Charged ({money(data.prices.inspection)})
              </label>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fr-std" className={labelCls}>Hours — Mon–Fri standard ({money(data.prices.labourPerHour)}/hr)</label>
              <input id="fr-std" type="number" min={0} step={0.5} className={inputCls} value={standardHours} onChange={(e) => setStandardHours(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
            <div>
              <label htmlFor="fr-ah" className={labelCls}>Hours — Mon–Fri after-hours ({money(data.prices.labourAfterHours)}/hr)</label>
              <input id="fr-ah" type="number" min={0} step={0.5} className={inputCls} value={afterHoursHours} onChange={(e) => setAfterHoursHours(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fr-sat" className={labelCls}>Hours — Saturday ({money(data.prices.labourSaturday)}/hr)</label>
              <input id="fr-sat" type="number" min={0} step={0.5} className={inputCls} value={saturdayHours} onChange={(e) => setSaturdayHours(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
            <div>
              <label htmlFor="fr-sun" className={labelCls}>Hours — Sunday ({money(data.prices.labourSunday)}/hr)</label>
              <input id="fr-sun" type="number" min={0} step={0.5} className={inputCls} value={sundayHours} onChange={(e) => setSundayHours(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fr-tkm" className={labelCls}>Travel — km from Armidale (${data.prices.travelPerKm.toFixed(2)}/km)</label>
              <input id="fr-tkm" type="number" min={0} step={1} className={inputCls} value={travelKm} onChange={(e) => setTravelKm(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
            <div>
              <label htmlFor="fr-thr" className={labelCls}>Travel — time on the road ({money(data.prices.travelTechPerHour)}/hr)</label>
              <input id="fr-thr" type="number" min={0} step={0.5} className={inputCls} value={travelHours} onChange={(e) => setTravelHours(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Admin fee</span>
              <label className="flex items-center gap-2 border-[1.5px] border-charcoal bg-background px-3 py-2.5 text-sm font-semibold text-charcoal">
                <input type="checkbox" checked={adminCharged} onChange={(e) => setAdminCharged(e.target.checked)} />
                Charged ({money(data.prices.adminFee)})
              </label>
            </div>
            <div>
              <span className={labelCls}>Insurer report fee</span>
              <label className="flex items-center gap-2 border-[1.5px] border-charcoal bg-background px-3 py-2.5 text-sm font-semibold text-charcoal">
                <input type="checkbox" checked={reportCharged} onChange={(e) => setReportCharged(e.target.checked)} />
                Charged ({money(data.prices.reportFee)})
              </label>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fr-fans" className={labelCls}>Drying fans used</label>
              <input id="fr-fans" type="number" min={0} max={40} className={inputCls} value={fans} onChange={(e) => setFans(Math.max(0, Math.round(num(e.target.valueAsNumber))))} />
            </div>
            <div>
              <label htmlFor="fr-fandays" className={labelCls}>Days fans stayed</label>
              <input id="fr-fandays" type="number" min={0} max={60} className={inputCls} value={fanDays} onChange={(e) => setFanDays(Math.max(0, Math.round(num(e.target.valueAsNumber))))} />
            </div>
          </div>
          <div className="border-[1.5px] border-charcoal bg-creamlight p-4">
            <p className="font-bold text-charcoal">Back for the after-flood clean?</p>
            <p className="mt-0.5 text-xs text-charcoal/60">
              The fans have dried it out and you're back to clean the carpet that
              was soaked. Charged per m² with no second callout fee — BFYB treat
              this as a new booking, so their customer cops another $289 minimum
              before the clean even starts.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fr-cleanm2" className={labelCls}>Carpet cleaned ({money(data.prices.returnCleanPerM2)}/m²)</label>
                <input id="fr-cleanm2" type="number" min={0} step={1} className={inputCls} value={returnCleanM2} onChange={(e) => setReturnCleanM2(Math.max(0, num(e.target.valueAsNumber)))} placeholder="m²" />
              </div>
              <div>
                <label htmlFor="fr-antimicro" className={labelCls}>Anti-microbial — areas treated ({money(data.prices.antimicroPerArea)}/area)</label>
                <input id="fr-antimicro" type="number" min={0} max={50} className={inputCls} value={antimicroAreas} onChange={(e) => setAntimicroAreas(Math.max(0, Math.round(num(e.target.valueAsNumber))))} />
              </div>
            </div>
          </div>
          <FloodWorkOrder id={data.lead.id} number={data.lead.workOrderNumber} doc={data.lead.workOrderDoc} />
          <FloodPhotos id={data.lead.id} />
          <div>
            <label htmlFor="fr-summary" className={labelCls}>What we found</label>
            <textarea id="fr-summary" className={`${inputCls} min-h-20`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Water through the kitchen and hallway from a burst flexi hose under the sink. Source stopped before arrival. Carpet and underlay saturated, no wall damage visible…" />
          </div>
          <div>
            <label htmlFor="fr-work" className={labelCls}>Work performed</label>
            <textarea id="fr-work" className={`${inputCls} min-h-20`} value={workDone} onChange={(e) => setWorkDone(e.target.value)} placeholder="Extracted standing water from all affected areas, lifted carpet edges to check underlay, applied anti-microbial, set 3 drying fans…" />
          </div>
          <div>
            <label htmlFor="fr-readings" className={labelCls}>Moisture readings & drying status</label>
            <textarea id="fr-readings" className={`${inputCls} min-h-20`} value={readings} onChange={(e) => setReadings(e.target.value)} placeholder="Kitchen 85% RH on arrival, 45% at pack-up. Fans left running — re-check booked for Thursday…" />
          </div>
          <div>
            <label htmlFor="fr-insurer" className={labelCls}>Notes for the insurer (optional)</label>
            <textarea id="fr-insurer" className={`${inputCls} min-h-16`} value={insurerNotes} onChange={(e) => setInsurerNotes(e.target.value)} placeholder="Underlay likely needs replacement in the hallway; carpet expected to be salvageable…" />
          </div>
        </div>

        {/* ── live price + actions ── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="border-[1.5px] border-charcoal bg-background p-5">
            <p className="font-display text-lg font-black text-charcoal">Charges</p>
            <ul className="mt-3 space-y-2 text-sm text-charcoal/80">
              {lines.length === 0 && <li className="text-charcoal/50">Add hours, fans or the inspection.</li>}
              {lines.map((l) => (
                <li key={l.label} className="flex items-start justify-between gap-3">
                  <span>{l.label}</span>
                  <span className="font-bold text-charcoal">{money(l.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t-[1.5px] border-charcoal pt-3">
              <span className="font-display text-lg font-black text-charcoal">Total</span>
              <span className="font-display text-2xl font-black text-forest">{money(total)}</span>
            </div>
            <p className="mt-2 text-xs text-charcoal/50">
              Published rates: {money(data.prices.labourPerHour)}/hr M–F · {money(data.prices.labourAfterHours)}/hr after-hours · {money(data.prices.labourSaturday)}/hr Sat · {money(data.prices.labourSunday)}/hr Sun · {money(data.prices.fanPerDay)}/fan/day · {money(data.prices.inspection)} inspection · ${data.prices.travelPerKm.toFixed(2)}/km + {money(data.prices.travelTechPerHour)}/hr travel · {money(data.prices.adminFee)} admin · {money(data.prices.reportFee)} report · {money(data.prices.returnCleanPerM2)}/m² recovery clean · {money(data.prices.antimicroPerArea)}/area anti-microbial
            </p>
            <button
              type="button"
              className="btn-pill mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
              disabled={total <= 0 || save.isPending}
              onClick={() => save.mutate({ id: data.lead.id, ...fields })}
            >
              {save.isPending ? "Saving…" : r ? "Save changes" : "Save report"}
            </button>
            <button
              type="button"
              className="mt-3 w-full border-[1.5px] border-charcoal bg-background px-4 py-2.5 font-bold text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canEmail || email.isPending}
              title={!data.lead.email ? "No customer email on this job" : !hasSaved ? "Save the report first" : dirty ? "Save your changes first" : undefined}
              onClick={() => email.mutate({ id: data.lead.id })}
            >
              {email.isPending ? "Sending…" : r?.emailedAt ? "Re-email PDF to customer" : "Email PDF to customer"}
            </button>
            <button
              type="button"
              className="mt-3 w-full border-[1.5px] border-charcoal bg-charcoal px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canEmail || invoice.isPending}
              title={!data.lead.email ? "No customer email on this job" : !hasSaved ? "Save the report first" : dirty ? "Save your changes first" : undefined}
              onClick={() => invoice.mutate({ id: data.lead.id })}
            >
              {invoice.isPending ? "Sending…" : `Invoice customer — ${money(total)}`}
            </button>
            {invoice.isError && <p className="mt-2 text-xs font-semibold text-destructive">{invoice.error.message}</p>}
            {invoice.isSuccess && invoice.data.invoice.sent && (
              <p className="mt-2 text-xs font-semibold text-[#15803D]">{invoice.data.invoice.detail}</p>
            )}
            {invoice.isSuccess && !invoice.data.invoice.sent && (
              <p className="mt-2 text-xs font-semibold text-charcoal/60">
                {invoice.data.invoice.detail}
                {invoice.data.invoice.alreadySent && (
                  <button
                    type="button"
                    className="ml-1 font-bold text-forest underline"
                    onClick={() => invoice.mutate({ id: data.lead.id, force: true })}
                  >
                    Send again
                  </button>
                )}
              </p>
            )}
            {dirty && hasSaved && (
              <p className="mt-2 text-xs font-semibold text-charcoal/60">
                Unsaved changes — save before emailing.
              </p>
            )}
            {save.isError && <p className="mt-2 text-xs font-semibold text-destructive">{save.error.message}</p>}
            {save.isSuccess && !dirty && <p className="mt-2 text-xs font-semibold text-[#15803D]">Saved.</p>}
            {email.isError && <p className="mt-2 text-xs font-semibold text-destructive">{email.error.message}</p>}
            {email.isSuccess && <p className="mt-2 text-xs font-semibold text-[#15803D]">Emailed to {data.lead.email}.</p>}
            {r?.emailedAt && !email.isSuccess && (
              <p className="mt-2 text-xs text-charcoal/50">
                Last emailed {new Date(r.emailedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.
              </p>
            )}
            <div className="mt-4 border-t-[1.5px] border-charcoal/20 pt-3 text-center">
              <DeleteFloodJob id={data.lead.id} name={data.lead.name} onDeleted={onBack} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface ReportFields {
  attendedAt: string;
  technicians: number;
  standardHours: number;
  afterHoursHours: number;
  saturdayHours: number;
  sundayHours: number;
  travelKm: number;
  travelHours: number;
  adminCharged: boolean;
  reportCharged: boolean;
  fans: number;
  fanDays: number;
  inspectionCharged: boolean;
  returnCleanM2: number;
  antimicroAreas: number;
  summary: string;
  workDone: string;
  readings: string;
  insurerNotes: string;
}
