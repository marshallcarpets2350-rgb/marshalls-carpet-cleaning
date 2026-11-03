/**
 * Flood job reports — pick a flood emergency job, log technicians, hours
 * (standard / after-hours) and drying fans, write the report, and it's
 * priced off the published flood rates. Save stores it on the job; the
 * email button sends the insurer-ready PDF to the customer.
 */
import { useMemo, useState } from "react";
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

/** The 11 editable fields, lifted off a stored report for dirty-checking. */
function snapshotOf(r: ReportFields): ReportFields {
  return {
    attendedAt: r.attendedAt,
    technicians: r.technicians,
    standardHours: r.standardHours,
    afterHoursHours: r.afterHoursHours,
    fans: r.fans,
    fanDays: r.fanDays,
    inspectionCharged: r.inspectionCharged,
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

  const floodLeads = useMemo(
    () => ((leads.data ?? []) as LeadRowLike[]).filter(isFloodLead),
    [leads.data],
  );

  if (selected !== null) {
    return <ReportEditor id={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-black text-charcoal">Flood job reports</h2>
      <p className="mt-1 text-sm text-charcoal/70">
        Log hours and fans after a flood callout — the report prices itself at
        the published rates and emails to the customer as an insurer-ready PDF.
      </p>
      <div className="mt-6 space-y-3">
        {floodLeads.length === 0 && (
          <p className="border-[1.5px] border-charcoal bg-background p-6 text-charcoal/70">
            No flood emergencies yet. When one comes in from the flood page it
            lands here.
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
              <button type="button" className="btn-pill" onClick={() => setSelected(l.id)}>
                {rep ? "Open report" : "Write report"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const data = trpc.admin.floodReportData.useQuery({ id });
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
  const [fans, setFans] = useState(r?.fans ?? 0);
  const [fanDays, setFanDays] = useState(r?.fanDays ?? 1);
  const [inspectionCharged, setInspectionCharged] = useState(r?.inspectionCharged ?? true);
  const [summary, setSummary] = useState(r?.summary ?? "");
  const [workDone, setWorkDone] = useState(r?.workDone ?? "");
  const [readings, setReadings] = useState(r?.readings ?? "");
  const [insurerNotes, setInsurerNotes] = useState(r?.insurerNotes ?? "");
  // The version the PDF email sends is always the last SAVED one.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(r ? JSON.stringify(snapshotOf(r)) : null);

  const fields: ReportFields = {
    attendedAt, technicians, standardHours, afterHoursHours, fans, fanDays,
    inspectionCharged, summary, workDone, readings, insurerNotes,
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
              <label htmlFor="fr-std" className={labelCls}>Hours on site — standard (7 AM – 7 PM)</label>
              <input id="fr-std" type="number" min={0} step={0.5} className={inputCls} value={standardHours} onChange={(e) => setStandardHours(Math.max(0, num(e.target.valueAsNumber)))} />
            </div>
            <div>
              <label htmlFor="fr-ah" className={labelCls}>Hours on site — after-hours (7 PM – 7 AM)</label>
              <input id="fr-ah" type="number" min={0} step={0.5} className={inputCls} value={afterHoursHours} onChange={(e) => setAfterHoursHours(Math.max(0, num(e.target.valueAsNumber)))} />
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
              Published rates: {money(data.prices.labourPerHour)}/hr standard · {money(data.prices.labourAfterHours)}/hr after-hours · {money(data.prices.fanPerDay)}/fan/day · {money(data.prices.inspection)} inspection
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
  fans: number;
  fanDays: number;
  inspectionCharged: boolean;
  summary: string;
  workDone: string;
  readings: string;
  insurerNotes: string;
}
