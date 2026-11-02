import { useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  BUSINESS,
  money,
  TIME_SLOTS,
  PURPOSE_LABELS,
  ACCESS_LABELS,
  RUG_PICKUP_LABELS,
  PAYMENT_LABELS,
  CONFIRM_LABELS,
  clockLabel,
  longDateLabel,
  HOME_BASE,
  SLOT_START_MINUTES,
  driveMinutesFor,
  slotsNeededFor,
  resolveRates,
  DEFAULT_RATES,
  RUG_SIZES,
  serviceSummary,
  serviceKinds,
  type BookingDetails,
  type QuoteInput,
  type Rates,
  type RateOverrides,
  type ServiceKind,
} from "@contracts/rates";

/** Job-list colour dots — yellow = rugs, blue = carpets, orange = lounges. */
const DOT_COLORS: Record<ServiceKind, string> = {
  rug: "#EAB308",
  carpet: "#1A6FD1",
  lounge: "#E8710A",
};
const DOT_LABELS: Record<ServiceKind, string> = {
  rug: "Rugs",
  carpet: "Carpets",
  lounge: "Lounges",
};

function ServiceDots({ kinds }: { kinds: ServiceKind[] }) {
  if (!kinds.length) return null;
  return (
    <span className="inline-flex translate-y-[1px] items-center gap-1" aria-label={kinds.map((k) => DOT_LABELS[k]).join(", ")}>
      {kinds.map((k) => (
        <span
          key={k}
          title={DOT_LABELS[k]}
          className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-charcoal/20"
          style={{ background: DOT_COLORS[k] }}
        />
      ))}
    </span>
  );
}

function DotLegend() {
  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-xs font-semibold text-charcoal/60">
      {(["rug", "carpet", "lounge"] as ServiceKind[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLORS[k] }} />
          {DOT_LABELS[k]}
        </span>
      ))}
    </span>
  );
}

const TOKEN_KEY = "mcc_admin_token";

type Tab = "overview" | "runsheet" | "leads" | "joblog" | "clients" | "availability" | "subscribers" | "newsletter" | "discounts" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "runsheet", label: "Run sheet" },
  { key: "leads", label: "Jobs" },
  { key: "joblog", label: "Job log" },
  { key: "clients", label: "Clients" },
  { key: "availability", label: "Availability" },
  { key: "subscribers", label: "Subscribers" },
  { key: "newsletter", label: "Newsletter" },
  { key: "discounts", label: "Discount codes" },
  { key: "settings", label: "Settings" },
];

/** One labelled price input — module-level so typing never remounts it. */
function PriceField({
  label,
  hint,
  value,
  onChange,
  step = "1",
  prefix = "$",
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-charcoal">{label}</span>
      <span className="flex items-center gap-2">
        {prefix && <span className="font-bold text-charcoal/50">{prefix}</span>}
        <input
          type="number"
          min={0}
          step={step}
          className="input-sharp"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </span>
      {hint && <span className="mt-1 block text-xs text-charcoal/50">{hint}</span>}
    </label>
  );
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","));
  const csv = [headers.join(","), ...body].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const utils = trpc.useUtils();

  const login = trpc.admin.login.useMutation({
    onSuccess: (r) => {
      localStorage.setItem(TOKEN_KEY, r.token);
      setToken(r.token);
    },
  });

  const stats = trpc.admin.stats.useQuery(undefined, {
    enabled: Boolean(token),
    retry: false,
  });

  if (token && stats.error?.data?.code === "UNAUTHORIZED") {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-creamlight px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ password });
          }}
          className="offset-shadow w-full max-w-sm border-[1.5px] border-charcoal bg-background p-8"
        >
          <p className="font-display text-2xl font-black text-charcoal">Marshall's admin</p>
          <label htmlFor="pw" className="mb-2 mt-6 block font-bold text-charcoal">
            Password
          </label>
          <input
            id="pw"
            type="password"
            className="input-sharp"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {login.isError && (
            <p className="mt-2 text-sm font-semibold text-destructive" role="alert">
              Wrong password.
            </p>
          )}
          <button type="submit" className="btn-pill mt-6 w-full" disabled={login.isPending}>
            {login.isPending ? "Checking…" : "Sign in"}
          </button>
          <p className="mt-4 text-center">
            <Link to="/" className="text-sm text-forest">← Back to the site</Link>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-creamlight">
      <header className="border-b-[1.5px] border-charcoal bg-charcoal text-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <p className="font-display text-xl font-black">
            Marshall's <span className="not-italic text-mint">admin</span>
          </p>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-mint no-underline hover:underline">
              View site
            </Link>
            <button
              type="button"
              className="text-sm text-background/70 hover:text-mint"
              onClick={() => {
                localStorage.removeItem(TOKEN_KEY);
                setToken(null);
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b-[1.5px] border-charcoal bg-background" aria-label="Admin sections">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 md:px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-4 px-4 py-3 font-bold ${
                tab === t.key
                  ? "border-forest text-forest"
                  : "border-transparent text-charcoal/60 hover:text-charcoal"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        {tab === "overview" && <Overview onGo={setTab} />}
        {tab === "runsheet" && <RunSheet />}
        {tab === "leads" && <Leads />}
        {tab === "joblog" && <JobLog />}
        {tab === "clients" && <Clients />}
        {tab === "availability" && <Availability />}
        {tab === "subscribers" && <Subscribers />}
        {tab === "newsletter" && <NewsletterTab />}
        {tab === "discounts" && <Discounts />}
        {tab === "settings" && <Settings />}
      </main>
    </div>
  );

  function Overview({ onGo }: { onGo: (t: Tab) => void }) {
    const s = trpc.admin.stats.useQuery();
    if (s.isPending) return <p>Loading…</p>;
    if (s.isError) return <p className="text-destructive">Couldn't load stats.</p>;
    const d = s.data;
    return (
      <div>
        <div className="grid gap-px border-[1.5px] border-charcoal bg-charcoal sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: d.activeSubscribers, label: "Active subscribers", tab: "subscribers" as Tab },
            { n: d.newLeads, label: "New quote leads", tab: "leads" as Tab },
            { n: d.leadsThisMonth, label: "Leads this month", tab: "leads" as Tab },
            { n: d.campaignsSent, label: "Campaigns sent", tab: "newsletter" as Tab },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onGo(c.tab)}
              className="bg-background p-6 text-left hover:bg-mintlight"
            >
              <p className="font-display text-4xl font-black text-forest">{c.n}</p>
              <p className="mt-1 font-semibold text-charcoal/70">{c.label}</p>
            </button>
          ))}
        </div>

        {!d.smtpConfigured && (
          <div className="mt-6 border-[1.5px] border-charcoal bg-cream p-5">
            <p className="font-bold text-charcoal">Email sending isn't set up yet.</p>
            <p className="mt-1 text-charcoal/80">
              Subscriber emails are being collected and stored — but to send the monthly
              newsletter from here, add your Gmail app password in{" "}
              <button type="button" onClick={() => onGo("settings")} className="font-bold text-forest underline">
                Settings
              </button>
              . Until then you can export the list as a CSV and send from your own email.
            </p>
          </div>
        )}

        <PriceWatch />

        <div className="mt-8 border-[1.5px] border-charcoal bg-background p-6">
          <h2 className="font-display text-xl font-black text-charcoal">Monthly rhythm</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-charcoal/80">
            <li>Check <strong>Quote leads</strong> and call the new ones.</li>
            <li>Write this month's deal in <strong>Newsletter</strong> — send yourself a test first.</li>
            <li>Send it to the list. Done for the month.</li>
          </ol>
        </div>
      </div>
    );
  }

  function PriceWatch() {
    const report = trpc.admin.priceWatch.useQuery();
    const run = trpc.admin.priceWatchRun.useMutation({
      onSuccess: () => utils.admin.priceWatch.invalidate(),
    });
    const r = report.data;
    return (
      <div className="mt-6 border-[1.5px] border-charcoal bg-background p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-black text-charcoal">
            BFYB price watch
          </h2>
          <button
            type="button"
            className="btn-pill-dark !px-5 !py-2 text-sm"
            disabled={run.isPending}
            onClick={() => run.mutate()}
          >
            {run.isPending ? "Checking their site…" : "Run check now"}
          </button>
        </div>
        <p className="mt-1 text-sm text-charcoal/60">
          Reads Bang For Ya Buck's live calculator once a day and confirms every
          quote stays at least 17% under theirs. If they move a price and your
          email is set up, you'll get a message about it.
        </p>
        {report.isPending ? (
          <p className="mt-4 text-charcoal/70">Loading…</p>
        ) : !r ? (
          <p className="mt-4 text-charcoal/70">No check has run yet — hit the button.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-charcoal/60">
              Last checked {new Date(r.checkedAt).toLocaleString("en-AU")}
            </p>
            {!r.fetchOk ? (
              <p className="mt-3 border-[1.5px] border-destructive p-3 text-sm font-semibold text-destructive" role="alert">
                Couldn't reach their site this time ({r.error}). It retries daily — if this
                persists for days, their calculator page may have moved.
              </p>
            ) : r.drifts.length === 0 ? (
              <p className="mt-3 border-[1.5px] border-forest bg-mintlight p-3 text-sm font-semibold text-forest" role="status">
                Their live prices match our model — and every reference job is at least
                17% under theirs.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 border-[1.5px] border-charcoal bg-cream p-4 text-sm font-semibold text-charcoal" role="alert">
                {r.drifts.map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            )}
            {r.margins.length > 0 && (
              <div className="mt-4 overflow-x-auto border-[1.5px] border-charcoal/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-charcoal/20 bg-creamlight text-left">
                      <th className="p-2.5">Reference job</th>
                      <th className="p-2.5">Us</th>
                      <th className="p-2.5">BFYB live</th>
                      <th className="p-2.5">Ours as % of theirs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.margins.map((m) => (
                      <tr key={m.label} className="border-b border-charcoal/10">
                        <td className="p-2.5">{m.label}</td>
                        <td className="p-2.5 font-semibold">
                          {money(m.ours)}
                          {m.oursList > m.ours && (
                            <span className="block text-xs font-normal text-charcoal/60">
                              list {money(m.oursList)} — auto-discounted
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">{money(m.theirs)}</td>
                        <td className={`p-2.5 font-bold ${m.pctOfTheirs <= 95 ? "text-forest" : "text-destructive"}`}>
                          {m.pctOfTheirs}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function RunSheet() {
    const todaySydney = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
    const [date, setDate] = useState(todaySydney);
    const q = trpc.admin.daySchedule.useQuery({ date });
    const d = q.data;

    const shift = (days: number) => {
      const base = new Date(`${date}T12:00:00`);
      base.setDate(base.getDate() + days);
      setDate(base.toLocaleDateString("en-CA"));
    };

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-charcoal">Run sheet</h2>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-pill-dark !px-4 !py-1.5 text-sm" onClick={() => shift(-1)}>←</button>
            <input
              type="date"
              className="input-sharp max-w-44 !py-1.5"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <button type="button" className="btn-pill-dark !px-4 !py-1.5 text-sm" onClick={() => shift(1)}>→</button>
            <button type="button" className="btn-pill !px-4 !py-1.5 text-sm" onClick={() => setDate(todaySydney)}>Today</button>
          </div>
        </div>
        <p className="mt-1 text-sm text-charcoal/70">
          {longDateLabel(date)} — your whole day, mapped from home and back.
        </p>

        {q.isPending && <p className="mt-6">Loading…</p>}

        {d && d.jobs.length === 0 && d.pickups.length === 0 && (
          <div className="mt-6 border-[1.5px] border-charcoal bg-creamlight p-6 text-center">
            <p className="font-display text-xl font-black text-charcoal">Nothing booked — the day's yours.</p>
            <p className="mt-1 text-sm text-charcoal/70">New bookings land here the moment they're made.</p>
          </div>
        )}

        {d && d.jobs.length > 0 && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-charcoal bg-mintlight p-4">
              <p className="font-bold text-charcoal">
                Leave home {d.leaveHomeMin !== null ? clockLabel(d.leaveHomeMin) : "—"}
                {" · "}{d.jobs.length} job{d.jobs.length > 1 ? "s" : ""}
                {" · "}home by {d.arriveHomeMin !== null ? clockLabel(d.arriveHomeMin) : "—"}
              </p>
              {d.mapsUrl && (
                <a href={d.mapsUrl} target="_blank" rel="noreferrer" className="btn-pill !px-5 !py-2 text-sm">
                  Open today's route in Google Maps
                </a>
              )}
            </div>

            <ol className="mt-6 space-y-0">
              <li className="flex items-center gap-3 py-2">
                <span className="text-xl" aria-hidden="true">🏠</span>
                <p className="font-bold text-charcoal">
                  {d.leaveHomeMin !== null ? clockLabel(d.leaveHomeMin) : ""} — leave home
                  <span className="block text-sm font-semibold text-charcoal/60">35 Campion Parade · gear loaded, bottles filled</span>
                </p>
              </li>
              {d.jobs.map((j, i) => (
                <li key={j.id}>
                  <div className="flex items-center gap-3 border-l-4 border-secondary py-2 pl-3">
                    <span className="text-xl" aria-hidden="true">🚗</span>
                    <p className="text-sm font-semibold text-charcoal/80">
                      {d.legs[i].minutes} min drive{d.legs[i].from !== "Home" ? ` from ${d.legs[i].from}` : ""} to {j.town}
                      {d.legs[i].slackMin !== null && d.legs[i].slackMin > 5 && (
                        <span className="text-charcoal/60"> · {d.legs[i].slackMin} min spare after the drive</span>
                      )}
                    </p>
                  </div>
                  <div className="border-[1.5px] border-charcoal bg-background p-4 offset-shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display text-xl font-black text-forest">
                        {clockLabel(j.startMin)} – {clockLabel(j.endMin)}
                      </p>
                      <p className="text-sm font-bold text-charcoal">
                        {money(j.total)}
                        {j.paidOnline || j.paidOfflineAt ? " · paid" : j.payment === "invoice" ? " · invoice" : " · on the day"}
                      </p>
                    </div>
                    <p className="mt-1 font-bold text-charcoal">
                      <ServiceDots kinds={j.kinds ?? []} /> {j.name} <span className="text-charcoal/50">({j.ref})</span>
                    </p>
                    <p className="text-sm text-charcoal/80">{j.service}</p>
                    <p className="mt-1 text-sm text-charcoal/80">
                      📍 {j.where || j.town}
                      {" · "}
                      <a href={`tel:${j.phone}`} className="font-semibold text-forest">{j.phone}</a>
                    </p>
                  </div>
                </li>
              ))}
              <li className="flex items-center gap-3 py-2">
                <span className="text-xl" aria-hidden="true">🏠</span>
                <p className="font-bold text-charcoal">
                  Home by {d.arriveHomeMin !== null ? clockLabel(d.arriveHomeMin) : "—"}
                  <span className="block text-sm font-semibold text-charcoal/60">{d.homeDrive} min drive back · job-done messages send themselves 30 min after each finish</span>
                </p>
              </li>
            </ol>
          </>
        )}

        {d && d.pickups.length > 0 && (
          <div className="mt-6 border-[1.5px] border-charcoal bg-creamlight p-4">
            <p className="font-bold text-charcoal">🧺 Rug pick-up run — 3:00 – 5:00 PM</p>
            <ul className="mt-2 space-y-2 text-sm text-charcoal/80">
              {d.pickups.map((p) => (
                <li key={p.id}>
                  <ServiceDots kinds={["rug"]} /> <strong>{p.name}</strong> ({p.ref}) — {p.rugs} · {p.where} ·{" "}
                  <a href={`tel:${p.phone}`} className="font-semibold text-forest">{p.phone}</a>
                  <span className="block pl-4 text-charcoal/60">
                    Collection: {p.collection}{p.note ? ` · Note: ${p.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function Leads() {
    const leads = trpc.admin.listLeads.useQuery();
    const update = trpc.admin.updateLeadStatus.useMutation({
      onSuccess: () => utils.admin.listLeads.invalidate(),
    });
    const sendConf = trpc.admin.sendConfirmationFor.useMutation({
      onSuccess: (r, v) => {
        setMsgNote((m) => ({
          ...m,
          [v.id]: r.emailSent || r.smsSent
            ? `Confirmation sent by ${[r.emailSent && "email", r.smsSent && "SMS"].filter(Boolean).join(" + ")}${r.detail ? ` (${r.detail})` : ""}`
            : `Couldn't send — ${r.detail || "check Settings"}`,
        }));
        utils.admin.listLeads.invalidate();
      },
      onError: (e, v) => setMsgNote((m) => ({ ...m, [v.id]: e.message })),
    });
    const complete = trpc.admin.completeAndThank.useMutation({
      onSuccess: (r, v) => {
        const receiptNote = r.receipt?.sent
          ? "receipt sent"
          : r.receipt?.alreadySent
            ? "receipt already sent"
            : `receipt not sent — ${r.receipt?.detail || "check Settings"}`;
        setMsgNote((m) => ({
          ...m,
          [v.id]: `Marked done — thank-you sent${r.reviewUrlSet ? " with the review link" : " (add your Google review link in Settings to include it)"} · ${receiptNote}${r.detail ? ` · ${r.detail}` : ""}`,
        }));
        utils.admin.listLeads.invalidate();
      },
      onError: (e, v) => setMsgNote((m) => ({ ...m, [v.id]: e.message })),
    });
    const markPaid = trpc.admin.markLeadPaid.useMutation({
      onSuccess: (_r, v) => {
        setMsgNote((m) => ({ ...m, [v.id]: v.paid ? "Marked paid ✓" : "Unmarked — back to unpaid" }));
        utils.admin.listLeads.invalidate();
      },
      onError: (e, v) => setMsgNote((m) => ({ ...m, [v.id]: e.message })),
    });
    const deleteLead = trpc.admin.deleteLead.useMutation({
      onSuccess: () => {
        setConfirmDeleteId(null);
        setOpenId(null);
        utils.admin.listLeads.invalidate();
        utils.public.listAvailability.invalidate();
      },
    });
    const [msgNote, setMsgNote] = useState<Record<number, string>>({});
    const [openId, setOpenId] = useState<number | null>(null);
    const [mapId, setMapId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    if (leads.isPending) return <p>Loading…</p>;
    const rows = leads.data ?? [];
    type Row = (typeof rows)[number];

    // Bucket every lead the way the operator thinks: dated jobs coming up,
    // things that still need action, and finished work.
    const todayIso = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
    const whenOf = (r: Row) => {
      const b = parseBooking(r.bookingJson);
      if (!b?.preferredDate) return null;
      const slotMin =
        b.preferredSlot !== null && b.preferredSlot !== undefined
          ? (SLOT_START_MINUTES[b.preferredSlot] ?? 420)
          : 420;
      return { date: b.preferredDate, sort: `${b.preferredDate}T${String(slotMin).padStart(4, "0")}` };
    };
    const isUpcoming = (r: Row) => {
      const w = whenOf(r);
      return r.status !== "completed" && !!w && w.date >= todayIso;
    };
    const upcoming = rows
      .filter(isUpcoming)
      .sort((a, b) => whenOf(a)!.sort.localeCompare(whenOf(b)!.sort));
    const needsAction = rows
      .filter((r) => r.status !== "completed" && !isUpcoming(r))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const done = rows
      .filter((r) => r.status === "completed")
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const groups: [string, Row[]][] = [
      ["Upcoming jobs", upcoming],
      ["Needs action", needsAction],
      ["Done", done],
    ];

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-charcoal">
            Jobs ({rows.length})
          </h2>
          <DotLegend />
          <button
            type="button"
            className="btn-pill-dark !px-5 !py-2 text-sm"
            onClick={() =>
              downloadCsv(
                "leads.csv",
                rows.map((r) => ({
                  ref: `MCC-${String(r.id).padStart(4, "0")}`,
                  name: r.name,
                  email: r.email,
                  phone: r.phone,
                  suburb: r.suburb,
                  distanceKm: r.distanceKm,
                  travelFee: r.travelFee,
                  total: r.total,
                  status: r.status,
                  date: new Date(r.createdAt).toLocaleDateString("en-AU"),
                })),
              )
            }
          >
            Export CSV
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 text-charcoal/70">No jobs yet — they'll land here when customers send quotes.</p>
        ) : (
          groups.map(([title, list]) =>
            list.length === 0 ? null : (
              <section key={title} className="mt-8 first:mt-6">
                <h3 className="font-display text-lg font-black uppercase tracking-wide text-charcoal/80">
                  {title} ({list.length})
                </h3>
                <ul className="mt-3 space-y-3">{list.map((r) => renderRow(r))}</ul>
              </section>
            ),
          )
        )}
      </div>
    );

    function renderRow(r: Row) {
              const quote = safeParse(r.quoteJson);
              const booking = parseBooking(r.bookingJson);
              const when = whenOf(r);
              const where = [r.address, r.suburb].filter(Boolean).join(", ");
              const driveMin = driveMinutesFor(booking?.town || r.suburb, r.distanceKm);
              return (
                <li key={r.id} className="border-[1.5px] border-charcoal bg-background">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-mintlight/50"
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    aria-expanded={openId === r.id}
                  >
                    <span>
                      <span className="font-bold text-charcoal">
                        <ServiceDots kinds={serviceKinds(quote?.input ?? null)} />{" "}
                        MCC-{String(r.id).padStart(4, "0")} · {r.name}
                      </span>
                      <span className="block text-sm text-charcoal/60">
                        {when && booking
                          ? `${new Date(when.date + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} · ${
                              booking.rugPickup
                                ? "3–5 PM rug run"
                                : booking.preferredSlot !== null && booking.preferredSlot !== undefined
                                  ? TIME_SLOTS[booking.preferredSlot]
                                  : "time to arrange"
                            } · ${booking.town || r.suburb || ""}`
                          : `${r.suburb || "Suburb n/a"} · sent ${new Date(r.createdAt).toLocaleDateString("en-AU")}`}
                      </span>
                      <span className="mt-0.5 block text-sm font-semibold text-charcoal/80">
                        {serviceSummary(quote?.input ?? null, booking?.rugPickup ?? false)}
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      {r.paidOnline && (
                        <span className="border border-forest bg-forest px-2 py-0.5 text-xs font-bold uppercase text-background">
                          Paid online
                        </span>
                      )}
                      {!r.paidOnline && r.paidOfflineAt && (
                        <span className="border border-forest bg-mintlight px-2 py-0.5 text-xs font-bold uppercase text-forest">
                          Paid ✓
                        </span>
                      )}
                      <span className="font-display text-xl font-black text-forest">{money(r.total)}</span>
                      <span
                        className={`border px-2 py-0.5 text-xs font-bold uppercase ${
                          r.status === "new"
                            ? "border-forest bg-mintlight text-forest"
                            : "border-charcoal/40 text-charcoal/60"
                        }`}
                      >
                        {r.status}
                      </span>
                    </span>
                  </button>
                  {openId === r.id && (
                    <div className="border-t-[1.5px] border-charcoal/20 p-4">
                      <p className="text-sm">
                        <strong>Phone:</strong>{" "}
                        <a href={`tel:${r.phone}`} className="text-forest">{r.phone}</a>
                        {" · "}
                        <strong>Email:</strong>{" "}
                        <a href={`mailto:${r.email}`} className="text-forest">{r.email}</a>
                      </p>
                      {where && (
                        <div className="mt-3 border-[1.5px] border-charcoal/40 bg-creamlight p-3">
                          <p className="text-sm">
                            <strong>📍 Where:</strong> {where}
                            <span className="text-charcoal/60">
                              {" "}· {driveMin > 0 ? `about ${driveMin} min from home` : "in town — about 10 min from home"}
                            </span>
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE.address)}&destination=${encodeURIComponent(where)}&travelmode=driving`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-pill !px-5 !py-2 text-sm no-underline"
                            >
                              🧭 Directions from home
                            </a>
                            <button
                              type="button"
                              className="btn-pill-dark !px-5 !py-2 text-sm"
                              onClick={() => setMapId(mapId === r.id ? null : r.id)}
                            >
                              {mapId === r.id ? "Hide map" : "Show map"}
                            </button>
                          </div>
                          {mapId === r.id && (
                            <iframe
                              title={`Map to ${where}`}
                              src={`https://maps.google.com/maps?q=${encodeURIComponent(where)}&output=embed`}
                              className="mt-3 h-56 w-full border-[1.5px] border-charcoal"
                              loading="lazy"
                            />
                          )}
                        </div>
                      )}
                      {quote?.breakdown?.lines && (
                        <ul className="mt-3 space-y-1 text-sm">
                          {quote.breakdown.lines.map((l: { label: string; amount: number }, i: number) => (
                            <li key={i} className="flex justify-between">
                              <span>{l.label}</span>
                              <span>{money(l.amount)}</span>
                            </li>
                          ))}
                          <li className="flex justify-between border-t pt-1">
                            <span>Travel</span>
                            <span>{money(quote.breakdown.travelFee)}</span>
                          </li>
                        </ul>
                      )}
                      {booking && (
                        <div className="mt-4 border-[1.5px] border-charcoal/40 bg-creamlight p-4 text-sm">
                          <p className="font-bold text-charcoal">Booking details</p>
                          <ul className="mt-2 space-y-1 text-charcoal/80">
                            {booking.preferredDate && booking.rugPickup ? (
                              <li>
                                <strong>Rug pickup:</strong>{" "}
                                {new Date(booking.preferredDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
                                {" · 3:00 – 5:00 PM → back Monday"}
                              </li>
                            ) : booking.preferredDate && booking.preferredSlot !== null && booking.preferredSlot !== undefined ? (
                              <li>
                                <strong>Requested:</strong>{" "}
                                {new Date(booking.preferredDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
                                {" · "}{TIME_SLOTS[booking.preferredSlot]}
                              </li>
                            ) : (
                              <li><strong>Requested:</strong> call to arrange a time</li>
                            )}
                            {!!booking.jobMinutes && !booking.rugPickup && (
                              <li>
                                <strong>Time on site:</strong> ~{(Math.round((booking.jobMinutes / 60) * 2) / 2).toString().replace(/\.5$/, "½")} hours
                                {" — "}blocks {slotsNeededFor(booking.jobMinutes)} slot{slotsNeededFor(booking.jobMinutes) > 1 ? "s" : ""}
                                {booking.town ? ` · ${booking.town}` : ""}
                              </li>
                            )}
                            {booking.secondVisit && (
                              <li>
                                <strong>Plan — clean 2 booked:</strong>{" "}
                                {new Date(booking.secondVisit.date + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                                {" · "}{TIME_SLOTS[booking.secondVisit.slot]}
                                {" (in the schedule as its own booking)"}
                              </li>
                            )}
                            {booking.purpose && <li><strong>Occasion:</strong> {PURPOSE_LABELS[booking.purpose]}</li>}
                            {booking.recommended && <li><strong>Recommended level:</strong> {booking.recommended}{booking.condition?.stainTypes?.length ? ` · stains: ${booking.condition.stainTypes.join(", ")}` : ""}</li>}
                            {booking.access?.method && (
                              <li>
                                <strong>{booking.rugPickup ? "Collection:" : "Access:"}</strong>{" "}
                                {booking.rugPickup
                                  ? (RUG_PICKUP_LABELS[booking.access.method] ?? ACCESS_LABELS[booking.access.method])
                                  : ACCESS_LABELS[booking.access.method]}
                                {booking.access.method === "agent" && booking.access.agency ? ` — ${booking.access.agency}` : ""}
                                {booking.access.method === "lockbox" && booking.access.spot ? ` — ${booking.access.spot}${booking.access.code ? ` (code ${booking.access.code})` : ""}` : ""}
                                {booking.access.method === "someone-else" && booking.access.name ? ` — ${booking.access.name} (${booking.access.mobile})` : ""}
                                {booking.access.method === "leave-out" && booking.access.spot ? ` — ${booking.access.spot}` : ""}
                                {booking.access.parking ? ` · parking: ${booking.access.parking === "close" ? "close" : "stairs/long carry"}` : ""}
                              </li>
                            )}
                            {booking.payment && <li><strong>Payment:</strong> {PAYMENT_LABELS[booking.payment]}</li>}
                            {booking.confirmBy && <li><strong>Confirm by:</strong> {CONFIRM_LABELS[booking.confirmBy]}</li>}
                            {booking.notes && <li><strong>Notes:</strong> {booking.notes}</li>}
                          </ul>
                        </div>
                      )}
                      {booking && (
                        <div className="mt-4 border-[1.5px] border-charcoal/40 bg-creamlight p-4 text-sm">
                          <p className="font-bold text-charcoal">Payment</p>
                          <p className="mt-1 text-charcoal/80">
                            {r.paidOnline
                              ? "Paid online by card ✓ — Stripe matched it to this job automatically."
                              : r.paidOfflineAt
                                ? `Marked paid ${new Date(r.paidOfflineAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ✓`
                                : booking.payment === "pay-now"
                                  ? "Paying online — Stripe marks this itself the moment the card goes through."
                                  : booking.payment === "invoice"
                                    ? `Invoice terms — watch Hnry/the bank for ${money(r.total)} with reference MCC-${String(r.id).padStart(4, "0")} (the invoice asks them to quote it).`
                                    : `Pay on the day — cash or PayID to ${BUSINESS.payId}, reference MCC-${String(r.id).padStart(4, "0")}.`}
                          </p>
                          {!r.paidOnline && (
                            <button
                              type="button"
                              className={`mt-3 !px-5 !py-2 text-sm ${r.paidOfflineAt ? "btn-pill-dark" : "btn-pill"}`}
                              disabled={markPaid.isPending}
                              onClick={() => markPaid.mutate({ id: r.id, paid: !r.paidOfflineAt })}
                            >
                              {r.paidOfflineAt ? "Unmark paid (tapped by mistake)" : "Payment received — mark paid"}
                            </button>
                          )}
                        </div>
                      )}
                      {booking && (
                        <div className="mt-4 border-[1.5px] border-charcoal/40 bg-mintlight p-4 text-sm">
                          <p className="font-bold text-charcoal">Customer messages</p>
                          <ul className="mt-2 space-y-1 text-charcoal/80">
                            <li>
                              <strong>Confirmation:</strong>{" "}
                              {r.confirmationSentAt
                                ? `sent ${new Date(r.confirmationSentAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}${r.confirmationDetail ? ` — ${r.confirmationDetail}` : ""}`
                                : r.confirmationDetail || "not sent yet"}
                            </li>
                            <li>
                              <strong>Job-done thanks + review ask:</strong>{" "}
                              {r.followUpSentAt
                                ? `sent ${new Date(r.followUpSentAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                                : "goes automatically 30 min after the job ends"}
                            </li>
                          </ul>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-pill !px-5 !py-2 text-sm"
                              disabled={sendConf.isPending}
                              onClick={() => sendConf.mutate({ id: r.id })}
                            >
                              {r.confirmationSentAt ? "Resend confirmation" : "Send confirmation"}
                            </button>
                            {!r.followUpSentAt && r.status !== "completed" && (
                              <button
                                type="button"
                                className="btn-pill-dark !px-5 !py-2 text-sm"
                                disabled={complete.isPending}
                                onClick={() => complete.mutate({ id: r.id })}
                              >
                                Job done — send thanks & review ask
                              </button>
                            )}
                          </div>
                          {msgNote[r.id] && (
                            <p className="mt-2 text-sm font-semibold text-forest">{msgNote[r.id]}</p>
                          )}
                        </div>
                      )}
                      <label className="mt-4 flex items-center gap-2 text-sm font-bold">
                        Status:
                        <select
                          className="input-sharp max-w-40 !py-1.5"
                          value={r.status}
                          onChange={(e) =>
                            update.mutate({ id: r.id, status: e.target.value as typeof r.status })
                          }
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="booked">Booked</option>
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                      <div className="mt-4 border-t-[1.5px] border-charcoal/15 pt-4">
                        {confirmDeleteId === r.id ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-bold text-destructive">
                              Delete MCC-{String(r.id).padStart(4, "0")} for good? This can't be undone
                              {r.paidOnline || r.paidOfflineAt ? " — it's marked PAID, so refund them in Stripe/bank first if money moved" : ""}.
                            </p>
                            <button
                              type="button"
                              className="btn-pill-dark !px-5 !py-2 text-sm"
                              disabled={deleteLead.isPending}
                              onClick={() => deleteLead.mutate({ id: r.id })}
                            >
                              {deleteLead.isPending ? "Deleting…" : "Yes, delete it"}
                            </button>
                            <button
                              type="button"
                              className="btn-pill !px-5 !py-2 text-sm"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Keep it
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-sm font-bold text-destructive underline-offset-4 hover:underline"
                            onClick={() => setConfirmDeleteId(r.id)}
                          >
                            Delete this booking (double-up, test, cancelled…)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
    }
  }

  function Availability() {
    const avail = trpc.public.listAvailability.useQuery();
    const blocks = trpc.admin.listBlocks.useQuery();
    const invalidate = () => {
      utils.public.listAvailability.invalidate();
      utils.admin.listBlocks.invalidate();
    };
    const block = trpc.admin.blockSlot.useMutation({ onSuccess: invalidate });
    const unblock = trpc.admin.unblockSlot.useMutation({ onSuccess: invalidate });
    const blockRange = trpc.admin.blockRange.useMutation({ onSuccess: invalidate });
    const unblockDay = trpc.admin.unblockDay.useMutation({ onSuccess: invalidate });
    const [holFrom, setHolFrom] = useState("");
    const [holTo, setHolTo] = useState("");

    if (avail.isPending || blocks.isPending) return <p>Loading…</p>;
    if (avail.isError) return <p className="text-destructive">Couldn't load the calendar.</p>;

    const blockMap = new Map((blocks.data ?? []).map((b) => [`${b.date}:${b.slot}`, b.id]));
    const busy = block.isPending || unblock.isPending || blockRange.isPending || unblockDay.isPending;

    // Days with at least one manual block, for the holiday list.
    const blockedDays = [...new Set((blocks.data ?? []).map((b) => b.date))].sort();

    return (
      <div>
        <h2 className="font-display text-2xl font-black text-charcoal">Your availability</h2>
        <p className="mt-2 max-w-xl text-charcoal/75">
          Tap a time to block it off — customers stop seeing it straight away.{" "}
          <strong>Booked</strong> means a customer has asked for it (check Jobs).{" "}
          Tap a <strong>Blocked</strong> time to open it back up. Customers also can't
          start a job that wouldn't leave enough room for the drive around the day's
          other bookings — that spacing happens automatically.
        </p>

        {/* Holiday / time off — close whole days at once */}
        <div className="mt-6 border-[1.5px] border-charcoal bg-mintlight p-5">
          <h3 className="font-display text-lg font-black text-charcoal">Holiday or time off?</h3>
          <p className="mt-1 text-sm text-charcoal/75">
            Pick the days you're away and bookings close for the whole stretch — nothing
            can be booked until you open the days again.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm font-bold text-charcoal">
              First day away
                              <input
                  type="date"
                  className="input-sharp mt-1 block !py-1.5"
                  value={holFrom}
                  onChange={(e) => setHolFrom(e.target.value)}
                />
            </label>
            <label className="text-sm font-bold text-charcoal">
              Last day away
              <input
                type="date"
                className="input-sharp mt-1 block !py-1.5"
                value={holTo}
                min={holFrom || undefined}
                onChange={(e) => setHolTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-pill !px-5 !py-2 text-sm"
              disabled={busy || !holFrom || !holTo}
              onClick={() => blockRange.mutate({ from: holFrom, to: holTo || holFrom })}
            >
              {blockRange.isPending ? "Closing…" : "Close those days"}
            </button>
          </div>
          {blockRange.isSuccess && blockRange.data.days > 0 && (
            <p className="mt-2 text-sm font-semibold text-forest">
              Closed {blockRange.data.days} day{blockRange.data.days > 1 ? "s" : ""} — customers can't book them.
            </p>
          )}
          {blockedDays.length > 0 && (
            <div className="mt-4 border-t-[1.5px] border-charcoal/20 pt-3">
              <p className="text-sm font-bold text-charcoal">Days with time blocked off:</p>
                              <ul className="mt-2 flex flex-wrap gap-2">
                  {blockedDays.map((date) => (
                    <li key={date} className="flex items-center gap-2 border-[1.5px] border-charcoal bg-background px-3 py-1.5 text-sm font-semibold text-charcoal">
                      {new Date(date + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                      <button
                        type="button"
                        className="font-bold text-destructive underline-offset-2 hover:underline"
                        disabled={busy}
                        onClick={() => unblockDay.mutate({ date })}
                        title="Open this day back up"
                      >
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {(avail.data ?? []).map((d, di, all) => {
            const label = new Date(d.date + "T12:00:00");
            const monthLabel = label.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
            const prevLabel = di > 0
              ? new Date(all[di - 1].date + "T12:00:00").toLocaleDateString("en-AU", { month: "long", year: "numeric" })
              : null;
            return (
              <div key={d.date}>
                {monthLabel !== prevLabel && (
                  <p className="mb-1 mt-6 text-sm font-bold uppercase tracking-widest text-charcoal/50 first:mt-0">
                    {monthLabel}
                  </p>
                )}
                <div className="border-[1.5px] border-charcoal bg-background p-4">
                <p className="font-bold text-charcoal">
                  {label.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                  {TIME_SLOTS.map((slotLabel, i) => {
                    const key = `${d.date}:${i}`;
                    const blockId = blockMap.get(key);
                    // occupied = inside a booking's span (or admin-blocked);
                    // slots merely kept clear for drive-time stay "Free" here.
                    const bookedByLead = d.occupied[i] && blockId === undefined;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={busy || bookedByLead}
                        onClick={() =>
                          blockId !== undefined
                            ? unblock.mutate({ id: blockId })
                            : block.mutate({ date: d.date, slot: i })
                        }
                        className={`border-[1.5px] px-2 py-2 text-xs font-bold transition-colors ${
                          bookedByLead
                            ? "border-forest bg-forest text-background"
                            : blockId !== undefined
                              ? "border-destructive bg-background text-destructive"
                              : "border-charcoal/30 bg-background text-charcoal hover:border-charcoal"
                        }`}
                      >
                        {slotLabel}
                        <span className="block text-[10px] font-semibold uppercase tracking-wide">
                          {bookedByLead ? "Booked" : blockId !== undefined ? "Blocked ✕" : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function Subscribers() {
    const subs = trpc.admin.listSubscribers.useQuery();
    const setStatus = trpc.admin.setSubscriberStatus.useMutation({
      onSuccess: () => utils.admin.listSubscribers.invalidate(),
    });
    if (subs.isPending) return <p>Loading…</p>;
    const rows = subs.data ?? [];

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-charcoal">
            Subscribers ({rows.filter((r) => r.status === "active").length} active)
          </h2>
          <button
            type="button"
            className="btn-pill-dark !px-5 !py-2 text-sm"
            onClick={() =>
              downloadCsv(
                "subscribers.csv",
                rows.map((r) => ({
                  email: r.email,
                  name: r.name,
                  source: r.source,
                  status: r.status,
                  joined: new Date(r.createdAt).toLocaleDateString("en-AU"),
                })),
              )
            }
          >
            Export CSV
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="mt-6 text-charcoal/70">No subscribers yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto border-[1.5px] border-charcoal">
            <table className="w-full bg-background text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-charcoal bg-creamlight text-left">
                  <th className="p-3">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-charcoal/10">
                    <td className="p-3">{r.email}</td>
                    <td className="p-3">{r.name ?? "—"}</td>
                    <td className="p-3">{r.source}</td>
                    <td className="p-3">{new Date(r.createdAt).toLocaleDateString("en-AU")}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setStatus.mutate({
                            id: r.id,
                            status: r.status === "active" ? "unsubscribed" : "active",
                          })
                        }
                        className={`border px-2 py-0.5 text-xs font-bold uppercase ${
                          r.status === "active"
                            ? "border-forest bg-mintlight text-forest"
                            : "border-charcoal/40 text-charcoal/50"
                        }`}
                      >
                        {r.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function NewsletterTab() {
    const campaigns = trpc.admin.listCampaigns.useQuery();
    const statsQ = trpc.admin.stats.useQuery();
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [testTo, setTestTo] = useState<string>(BUSINESS.email);
    const [result, setResult] = useState("");
    const send = trpc.admin.sendCampaign.useMutation({
      onSuccess: (r) => {
        setResult(
          r.test
            ? `Test sent to ${testTo}.`
            : `Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}${r.failed ? ` (${r.failed} failed)` : ""}.`,
        );
        if (!r.test) {
          setSubject("");
          setBody("");
        }
        utils.admin.listCampaigns.invalidate();
        utils.admin.stats.invalidate();
      },
      onError: (e) => setResult(e.message),
    });

    return (
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-black text-charcoal">Write the newsletter</h2>
          {statsQ.data && !statsQ.data.smtpConfigured && (
            <p className="mt-3 border-[1.5px] border-charcoal bg-cream p-3 text-sm text-charcoal/80">
              Sending isn't configured yet — add SMTP details in Settings, or export the
              subscriber CSV and send from your own email.
            </p>
          )}
          <label className="mb-2 mt-5 block font-bold text-charcoal">Subject</label>
          <input
            className="input-sharp"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="October deals — 15% off upholstery this month"
          />
          <label className="mb-2 mt-5 block font-bold text-charcoal">Message</label>
          <textarea
            className="input-sharp min-h-56"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"G'day —\n\nThis month we're doing…\n\nBook: 0423 581 223"}
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              className="input-sharp max-w-64"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              aria-label="Send test to"
            />
            <button
              type="button"
              className="btn-pill-dark !px-5 !py-2.5 text-sm"
              disabled={send.isPending || !subject || !body}
              onClick={() => send.mutate({ subject, body, testTo })}
            >
              Send me a test
            </button>
            <button
              type="button"
              className="btn-pill !px-5 !py-2.5 text-sm"
              disabled={send.isPending || !subject || !body}
              onClick={() => {
                if (window.confirm(`Send to all ${statsQ.data?.activeSubscribers ?? ""} active subscribers?`)) {
                  send.mutate({ subject, body });
                }
              }}
            >
              {send.isPending ? "Sending…" : "Send to the list"}
            </button>
          </div>
          {result && <p className="mt-3 font-semibold text-forest" role="status">{result}</p>}
        </div>

        <div>
          <h2 className="font-display text-2xl font-black text-charcoal">Past campaigns</h2>
          {campaigns.isPending ? (
            <p className="mt-4">Loading…</p>
          ) : (campaigns.data ?? []).length === 0 ? (
            <p className="mt-4 text-charcoal/70">Nothing sent yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(campaigns.data ?? []).map((c) => (
                <li key={c.id} className="border-[1.5px] border-charcoal bg-background p-4">
                  <p className="font-bold text-charcoal">{c.subject}</p>
                  <p className="text-sm text-charcoal/60">
                    {new Date(c.sentAt).toLocaleDateString("en-AU")} · sent {c.sentCount}/{c.audienceCount}
                    {c.failCount > 0 && ` · ${c.failCount} failed`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  function Discounts() {
    const codes = trpc.admin.listDiscountCodes.useQuery();
    const [code, setCode] = useState("");
    const [percent, setPercent] = useState("10");
    const create = trpc.admin.createDiscountCode.useMutation({
      onSuccess: () => {
        setCode("");
        utils.admin.listDiscountCodes.invalidate();
      },
    });
    const toggle = trpc.admin.setDiscountActive.useMutation({
      onSuccess: () => utils.admin.listDiscountCodes.invalidate(),
    });

    return (
      <div>
        <h2 className="font-display text-2xl font-black text-charcoal">Discount codes</h2>
        <form
          className="mt-5 flex max-w-lg flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ code, percentOff: Number(percent) });
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Code</span>
            <input
              className="input-sharp w-44 uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SPRING15"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">% off</span>
            <input
              className="input-sharp w-24"
              inputMode="numeric"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^0-9]/g, ""))}
              required
            />
          </label>
          <button type="submit" className="btn-pill !px-5 !py-2.5 text-sm" disabled={create.isPending}>
            Create
          </button>
        </form>
        {create.isError && (
          <p className="mt-2 text-sm font-semibold text-destructive">{create.error.message}</p>
        )}

        <ul className="mt-6 max-w-2xl space-y-2">
          {(codes.data ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between border-[1.5px] border-charcoal bg-background p-4"
            >
              <span>
                <span className="font-display text-lg font-black text-forest">{c.code}</span>
                <span className="ml-3 text-charcoal/70">{c.percentOff}% off · used {c.uses}×</span>
              </span>
              <button
                type="button"
                onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                className={`border px-3 py-1 text-xs font-bold uppercase ${
                  c.active ? "border-forest bg-mintlight text-forest" : "border-charcoal/40 text-charcoal/50"
                }`}
              >
                {c.active ? "Active" : "Off"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function Prices() {
    const saved = trpc.admin.getRateOverrides.useQuery();
    const [form, setForm] = useState<Rates | null>(null);
    const [editing, setEditing] = useState(false);
    const [pMsg, setPMsg] = useState("");
    const [err, setErr] = useState("");
    const savePrices = trpc.admin.saveRateOverrides.useMutation({
      onSuccess: async (_r, v) => {
        // Prove the save landed: read the card straight back from the
        // server and only call it saved when it matches what we sent.
        const fresh = await utils.admin.getRateOverrides.fetch();
        utils.admin.getRateOverrides.invalidate();
        if (JSON.stringify(fresh ?? null) === JSON.stringify(v.overrides ?? null)) {
          setPMsg(v.overrides
            ? "Saved ✓ — checked against the server and locked in. Every new quote uses these prices from now on."
            : "Saved ✓ — checked and locked in. Every new quote is back on the original prices.");
          setErr("");
          setForm(null);
          setEditing(false);
        } else {
          setErr("Couldn't confirm the save — press Save prices once more.");
        }
      },
      onError: (e) => { setPMsg(""); setErr(e.message); },
    });

    if (saved.isPending) return <p>Loading…</p>;
    const r = form ?? structuredClone(resolveRates((saved.data as RateOverrides | null) ?? null));
    const customised = Boolean(saved.data);

    const set = (fn: (draft: Rates) => void) => {
      const draft = structuredClone(r);
      fn(draft);
      setForm(draft);
      setPMsg("");
      setErr("");
    };
    const startEdit = () => {
      setForm(structuredClone(r));
      setEditing(true);
      setPMsg("");
      setErr("");
    };
    const cancelEdit = () => {
      setForm(null);
      setEditing(false);
      setErr("");
    };
    const was = (orig: number, cur: number, fmt: (n: number) => string = money) =>
      orig !== cur ? `Original: ${fmt(orig)}` : undefined;

    const save = () => {
      const ups = r.carpet.tiers.slice(0, -1).map((t) => t.upTo);
      if (ups.some((u, i) => u <= 0 || (i > 0 && u <= ups[i - 1]))) {
        setErr("The m² steps must go up in order — each one bigger than the last.");
        return;
      }
      const overrides: RateOverrides = {
        minimumCharge: r.minimumCharge,
        carpetTiers: r.carpet.tiers.map((t, i, arr) => ({
          upTo: i === arr.length - 1 ? null : t.upTo,
          perM2: t.perM2,
        })),
        carpetMultiplier: { ...r.carpet.multiplier },
        loungePerSeat: { ...r.lounge.perSeat },
        reclinerPerSeat: r.lounge.reclinerPerSeat,
        mattressBase: { ...r.mattress.base },
        stainCauseFee: { ...r.stainCauseFee },
        rugPrices: { ...r.rugPrices },
        rugBulkPercentOff: r.rug.bulkPercentOff,
        travelFreeRadiusKm: r.travel.freeRadiusKm,
        travelPerKmEachWay: r.travel.perKmEachWay,
        travelFlatByTown: { ...r.travel.flatByTown },
        rugPerKm: r.travel.rugPerKm,
        volumeEvery: r.volumeDiscount.every,
        volumeOff: r.volumeDiscount.off,
        maintenanceTwoOff: r.maintenance.two,
      };
      savePrices.mutate({ overrides });
    };

    const card = "border-[1.5px] border-charcoal bg-background p-5";
    const grid = "mt-4 grid gap-4 sm:grid-cols-2";
    const h3 = "font-display text-lg font-black text-charcoal";
    const sub = "mt-1 text-sm text-charcoal/70";

    // ── Locked view: read-only rate card, nothing can change until
    // "Edit prices" is deliberately pressed. ─────────────────────────
    if (!editing) {
      const f2 = (n: number) => `$${n.toFixed(2)}`;
      const townRows = Object.entries(r.travel.flatByTown).map(
        ([t, fee]) => [`Flat fee — ${t[0].toUpperCase()}${t.slice(1)}`, money(fee)] as [string, string],
      );
      const lockedCards: { title: string; rows: [string, string][] }[] = [
        { title: "Minimum charge", rows: [["The least a job can come to", money(r.minimumCharge)]] },
        { title: "Carpet — per square metre", rows: [
          [`First ${r.carpet.tiers[0].upTo} m²`, `${f2(r.carpet.tiers[0].perM2)}/m²`],
          [`Up to ${r.carpet.tiers[1].upTo} m²`, `${f2(r.carpet.tiers[1].perM2)}/m²`],
          [`Up to ${r.carpet.tiers[2].upTo} m²`, `${f2(r.carpet.tiers[2].perM2)}/m²`],
          ["Every m² past that", `${f2(r.carpet.tiers[3].perM2)}/m²`],
        ]},
        { title: "Clean levels", rows: [
          ["Deep clean", `×${r.carpet.multiplier.medium} the standard figure`],
          ["Restoration clean", `×${r.carpet.multiplier.heavy} the standard figure`],
        ]},
        { title: "Lounges", rows: [
          ["Per seat — light", money(r.lounge.perSeat.light)],
          ["Per seat — medium", money(r.lounge.perSeat.medium)],
          ["Per seat — heavy", money(r.lounge.perSeat.heavy)],
          ["Extra per recliner seat", money(r.lounge.reclinerPerSeat)],
        ]},
        { title: "Mattresses", rows: [
          ["Single", money(r.mattress.base.single)],
          ["Double", money(r.mattress.base.double)],
          ["Queen", money(r.mattress.base.queen)],
          ["King", money(r.mattress.base.king)],
        ]},
        { title: "Stain treatment", rows: [
          ["Pet accidents", money(r.stainCauseFee["pet-urine"])],
          ["Food & drink", money(r.stainCauseFee["food-drink"])],
          ["Mud & heavy traffic", money(r.stainCauseFee["mud-traffic"])],
          ["Not sure what it is", money(r.stainCauseFee["not-sure"])],
        ]},
        { title: "Travel", rows: [
          ["Armidale", "Free"],
          ["Per km each way outside Armidale", f2(r.travel.perKmEachWay)],
          ...townRows.filter(([label]) => !label.toLowerCase().endsWith("armidale")),
        ]},
        { title: "Rugs — pick-up & clean", rows: [
          ...RUG_SIZES.map((s) => [`${s.label} (${s.area})`, money(r.rugPrices[s.id])] as [string, string]),
          ["When 5 or more rugs", `${r.rug.bulkPercentOff}% off`],
        ]},
        { title: "Automatic discounts", rows: [
          ["$ off…", money(r.volumeDiscount.off)],
          ["…for every full $ of the clean", money(r.volumeDiscount.every)],
          ["2-cleans-a-year plan", `${Math.round(r.maintenance.two * 100)}% off every clean`],
        ]},
      ];

      return (
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-black text-charcoal">Prices</h2>
            <span className="border border-forest bg-mintlight px-2 py-0.5 text-xs font-bold uppercase text-forest">
              ✓ Locked in
            </span>
            {customised && (
              <span className="border border-charcoal/40 px-2 py-0.5 text-xs font-bold uppercase text-charcoal/60">
                Custom prices active
              </span>
            )}
          </div>
          <p className={sub}>
            These are the live prices — every new quote on the site uses them. They're locked so
            nothing changes by accident. To change anything, tap <strong>Edit prices</strong>,
            make your changes, then <strong>Save prices</strong> — the save is checked against the
            server and locked in again.
          </p>
          {pMsg && (
            <p className="mt-4 border-[1.5px] border-forest bg-mintlight p-3 text-sm font-bold text-forest" role="status">
              {pMsg}
            </p>
          )}
          <div className="mt-6 space-y-6">
            {lockedCards.map((c) => (
              <div key={c.title} className={card}>
                <h3 className={h3}>{c.title}</h3>
                <dl className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                  {c.rows.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3 border-b border-charcoal/10 pb-1 text-sm">
                      <dt className="text-charcoal/70">{label}</dt>
                      <dd className="font-bold text-charcoal">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button type="button" className="btn-pill" onClick={startEdit}>
              Edit prices
            </button>
          </div>
        </section>
      );
    }

    // ── Edit view ───────────────────────────────────────────────────
    return (
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-charcoal">Prices — editing</h2>
          <span className="border border-destructive px-2 py-0.5 text-xs font-bold uppercase text-destructive">
            Unlocked
          </span>
        </div>
        <p className={sub}>
          Nothing here is live until you press <strong>Save prices</strong>. The save is checked
          against the server — you'll see "Saved ✓" and the prices lock again. Quotes already sent
          to customers keep the price they were sent at.
        </p>

        <div className="mt-6 space-y-6">
          <div className={card}>
            <h3 className={h3}>Minimum charge</h3>
            <p className={sub}>The least a job can come to — covers the truck and the trip.</p>
            <div className={grid}>
              <PriceField label="Minimum charge" value={r.minimumCharge}
                hint={was(DEFAULT_RATES.minimumCharge, r.minimumCharge)}
                onChange={(v) => set((d) => { d.minimumCharge = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Carpet — per square metre</h3>
            <p className={sub}>
              Stepped rates: the bigger the house, the cheaper each metre gets. Each step prices
              only its own metres — like tax brackets.
            </p>
            <div className={grid}>
              <PriceField label="First step — up to this many m²" step="1" prefix=""
                value={r.carpet.tiers[0].upTo}
                onChange={(v) => set((d) => { d.carpet.tiers[0].upTo = v; })} />
              <PriceField label="…at $ per m²" step="0.05" value={r.carpet.tiers[0].perM2}
                hint={was(DEFAULT_RATES.carpet.tiers[0].perM2, r.carpet.tiers[0].perM2, (n) => `$${n.toFixed(2)}`)}
                onChange={(v) => set((d) => { d.carpet.tiers[0].perM2 = v; })} />
              <PriceField label="Second step — up to this many m²" step="1" prefix=""
                value={r.carpet.tiers[1].upTo}
                onChange={(v) => set((d) => { d.carpet.tiers[1].upTo = v; })} />
              <PriceField label="…at $ per m²" step="0.05" value={r.carpet.tiers[1].perM2}
                hint={was(DEFAULT_RATES.carpet.tiers[1].perM2, r.carpet.tiers[1].perM2, (n) => `$${n.toFixed(2)}`)}
                onChange={(v) => set((d) => { d.carpet.tiers[1].perM2 = v; })} />
              <PriceField label="Third step — up to this many m²" step="1" prefix=""
                value={r.carpet.tiers[2].upTo}
                onChange={(v) => set((d) => { d.carpet.tiers[2].upTo = v; })} />
              <PriceField label="…at $ per m²" step="0.05" value={r.carpet.tiers[2].perM2}
                hint={was(DEFAULT_RATES.carpet.tiers[2].perM2, r.carpet.tiers[2].perM2, (n) => `$${n.toFixed(2)}`)}
                onChange={(v) => set((d) => { d.carpet.tiers[2].perM2 = v; })} />
              <PriceField label="Every m² past that" step="0.05" value={r.carpet.tiers[3].perM2}
                hint={was(DEFAULT_RATES.carpet.tiers[3].perM2, r.carpet.tiers[3].perM2, (n) => `$${n.toFixed(2)}`)}
                onChange={(v) => set((d) => { d.carpet.tiers[3].perM2 = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Clean levels</h3>
            <p className={sub}>
              Deeper cleans multiply the standard carpet figure. Standard is always ×1.
            </p>
            <div className={grid}>
              <PriceField label="Deep clean — × the standard figure" step="0.05" prefix="×"
                value={r.carpet.multiplier.medium}
                hint={was(DEFAULT_RATES.carpet.multiplier.medium, r.carpet.multiplier.medium, (n) => `×${n}`)}
                onChange={(v) => set((d) => { d.carpet.multiplier.medium = v; })} />
              <PriceField label="Restoration clean — × the standard figure" step="0.05" prefix="×"
                value={r.carpet.multiplier.heavy}
                hint={was(DEFAULT_RATES.carpet.multiplier.heavy, r.carpet.multiplier.heavy, (n) => `×${n}`)}
                onChange={(v) => set((d) => { d.carpet.multiplier.heavy = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Lounges</h3>
            <p className={sub}>Per seat, by how the lounge's been looked after.</p>
            <div className={grid}>
              <PriceField label="Per seat — light" value={r.lounge.perSeat.light}
                hint={was(DEFAULT_RATES.lounge.perSeat.light, r.lounge.perSeat.light)}
                onChange={(v) => set((d) => { d.lounge.perSeat.light = v; })} />
              <PriceField label="Per seat — medium" value={r.lounge.perSeat.medium}
                hint={was(DEFAULT_RATES.lounge.perSeat.medium, r.lounge.perSeat.medium)}
                onChange={(v) => set((d) => { d.lounge.perSeat.medium = v; })} />
              <PriceField label="Per seat — heavy" value={r.lounge.perSeat.heavy}
                hint={was(DEFAULT_RATES.lounge.perSeat.heavy, r.lounge.perSeat.heavy)}
                onChange={(v) => set((d) => { d.lounge.perSeat.heavy = v; })} />
              <PriceField label="Extra per recliner seat" value={r.lounge.reclinerPerSeat}
                hint={was(DEFAULT_RATES.lounge.reclinerPerSeat, r.lounge.reclinerPerSeat)}
                onChange={(v) => set((d) => { d.lounge.reclinerPerSeat = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Mattresses</h3>
            <div className={grid}>
              <PriceField label="Single" value={r.mattress.base.single}
                hint={was(DEFAULT_RATES.mattress.base.single, r.mattress.base.single)}
                onChange={(v) => set((d) => { d.mattress.base.single = v; })} />
              <PriceField label="Double" value={r.mattress.base.double}
                hint={was(DEFAULT_RATES.mattress.base.double, r.mattress.base.double)}
                onChange={(v) => set((d) => { d.mattress.base.double = v; })} />
              <PriceField label="Queen" value={r.mattress.base.queen}
                hint={was(DEFAULT_RATES.mattress.base.queen, r.mattress.base.queen)}
                onChange={(v) => set((d) => { d.mattress.base.queen = v; })} />
              <PriceField label="King" value={r.mattress.base.king}
                hint={was(DEFAULT_RATES.mattress.base.king, r.mattress.base.king)}
                onChange={(v) => set((d) => { d.mattress.base.king = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Stain treatment</h3>
            <p className={sub}>
              Priced for the toughest stain ticked; each extra type at half. Free on a Restoration clean.
            </p>
            <div className={grid}>
              <PriceField label="Pet accidents" value={r.stainCauseFee["pet-urine"]}
                hint={was(DEFAULT_RATES.stainCauseFee["pet-urine"], r.stainCauseFee["pet-urine"])}
                onChange={(v) => set((d) => { d.stainCauseFee["pet-urine"] = v; })} />
              <PriceField label="Food & drink" value={r.stainCauseFee["food-drink"]}
                hint={was(DEFAULT_RATES.stainCauseFee["food-drink"], r.stainCauseFee["food-drink"])}
                onChange={(v) => set((d) => { d.stainCauseFee["food-drink"] = v; })} />
              <PriceField label="Mud & heavy traffic" value={r.stainCauseFee["mud-traffic"]}
                hint={was(DEFAULT_RATES.stainCauseFee["mud-traffic"], r.stainCauseFee["mud-traffic"])}
                onChange={(v) => set((d) => { d.stainCauseFee["mud-traffic"] = v; })} />
              <PriceField label="Not sure what it is" value={r.stainCauseFee["not-sure"]}
                hint={was(DEFAULT_RATES.stainCauseFee["not-sure"], r.stainCauseFee["not-sure"])}
                onChange={(v) => set((d) => { d.stainCauseFee["not-sure"] = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Travel</h3>
            <p className={sub}>
              Free in Armidale, per-kilometre outside town — with flat fees for the towns
              you service most.
            </p>
            <div className={grid}>
              <PriceField label="Per km each way outside Armidale" step="0.10"
                value={r.travel.perKmEachWay}
                hint={was(DEFAULT_RATES.travel.perKmEachWay, r.travel.perKmEachWay, (n) => `$${n.toFixed(2)}`)}
                onChange={(v) => set((d) => { d.travel.perKmEachWay = v; })} />
              {Object.entries(r.travel.flatByTown).map(([town, fee]) => (
                <PriceField key={town}
                  label={`Flat travel fee — ${town[0].toUpperCase()}${town.slice(1)}`}
                  value={fee}
                  hint={was(DEFAULT_RATES.travel.flatByTown[town] ?? -1, fee)}
                  onChange={(v) => set((d) => { d.travel.flatByTown[town] = v; })} />
              ))}
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Rugs — pick-up & clean</h3>
            <div className={grid}>
              {RUG_SIZES.map((size) => (
                <PriceField key={size.id}
                  label={`${size.label} (${size.area})`}
                  value={r.rugPrices[size.id]}
                  hint={was(DEFAULT_RATES.rugPrices[size.id], r.rugPrices[size.id])}
                  onChange={(v) => set((d) => { d.rugPrices[size.id] = v; })} />
              ))}
              <PriceField label="% off when 5 or more rugs" step="1" prefix="%"
                value={r.rug.bulkPercentOff}
                hint={was(DEFAULT_RATES.rug.bulkPercentOff, r.rug.bulkPercentOff, (n) => `${n}%`)}
                onChange={(v) => set((d) => { d.rug.bulkPercentOff = v; })} />
            </div>
          </div>

          <div className={card}>
            <h3 className={h3}>Automatic discounts</h3>
            <div className={grid}>
              <PriceField label="$ off…" value={r.volumeDiscount.off}
                hint={was(DEFAULT_RATES.volumeDiscount.off, r.volumeDiscount.off)}
                onChange={(v) => set((d) => { d.volumeDiscount.off = v; })} />
              <PriceField label="…for every full $ of the clean" value={r.volumeDiscount.every}
                hint={was(DEFAULT_RATES.volumeDiscount.every, r.volumeDiscount.every)}
                onChange={(v) => set((d) => { d.volumeDiscount.every = v; })} />
              <PriceField label="2-cleans-a-year plan — % off every clean" step="1" prefix="%"
                value={Math.round(r.maintenance.two * 100)}
                hint={was(Math.round(DEFAULT_RATES.maintenance.two * 100), Math.round(r.maintenance.two * 100), (n) => `${n}%`)}
                onChange={(v) => set((d) => { d.maintenance.two = v / 100; })} />
            </div>
          </div>
        </div>

        {err && <p className="mt-4 text-sm font-semibold text-destructive" role="alert">{err}</p>}
        {pMsg && <p className="mt-4 text-sm font-semibold text-forest">{pMsg}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn-pill" onClick={save} disabled={savePrices.isPending}>
            {savePrices.isPending ? "Saving & checking…" : "Save prices & lock in"}
          </button>
          <button type="button" className="btn-pill-dark" onClick={cancelEdit} disabled={savePrices.isPending}>
            Cancel — don't change anything
          </button>
          {customised && (
            <button
              type="button"
              className="btn-pill-dark"
              disabled={savePrices.isPending}
              onClick={() => {
                if (window.confirm("Put every price back to the original figures?")) {
                  savePrices.mutate({ overrides: null });
                }
              }}
            >
              Back to original prices
            </button>
          )}
        </div>
      </section>
    );
  }

  function JobLog() {
    const leads = trpc.admin.listLeads.useQuery();
    const [q, setQ] = useState("");
    const [openId, setOpenId] = useState<number | null>(null);
    if (leads.isPending) return <p>Loading…</p>;
    const rows = leads.data ?? [];
    type Row = (typeof rows)[number];

    const jobDateOf = (r: Row) =>
      parseBooking(r.bookingJson)?.preferredDate ??
      new Date(r.createdAt).toLocaleDateString("en-CA");
    const sorted = rows
      .slice()
      .sort((a, b) => jobDateOf(b).localeCompare(jobDateOf(a)) || b.id - a.id);
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? sorted.filter((r) =>
          [r.name, r.email, r.phone, r.suburb, r.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : sorted;

    const dateLabel = (iso: string) =>
      new Date(iso + "T12:00:00").toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-charcoal">
            Job log ({filtered.length})
          </h2>
          <button
            type="button"
            className="btn-pill-dark !px-5 !py-2 text-sm"
            onClick={() =>
              downloadCsv(
                "job-log.csv",
                filtered.map((r) => {
                  const b = parseBooking(r.bookingJson);
                  const quote = safeParse(r.quoteJson);
                  return {
                    ref: `MCC-${String(r.id).padStart(4, "0")}`,
                    jobDate: jobDateOf(r),
                    name: r.name,
                    phone: r.phone,
                    email: r.email,
                    address: [r.address, r.suburb].filter(Boolean).join(", "),
                    job: (quote?.breakdown?.lines ?? []).map((l) => l.label).join("; "),
                    travelFee: r.travelFee,
                    total: r.total,
                    status: r.status,
                    paidOnline: r.paidOnline ? "yes" : "no",
                    sentIn: new Date(r.createdAt).toLocaleDateString("en-AU"),
                    bookedSlot: b?.preferredSlot !== null && b?.preferredSlot !== undefined ? TIME_SLOTS[b.preferredSlot] : "",
                  };
                }),
              )
            }
          >
            Export CSV
          </button>
        </div>
        <p className="mt-1 text-sm text-charcoal/70">
          Every job and quote that's come through the site, newest job date first — the permanent
          record. The CSV is your address book: names, numbers and where every job was.
        </p>
        <input
          type="search"
          className="input-sharp mt-4"
          placeholder="Search name, phone, email or address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the job log"
        />

        {filtered.length === 0 ? (
          <p className="mt-6 text-charcoal/70">
            {rows.length === 0 ? "Nothing logged yet — jobs land here as they come in." : "No matches."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((r) => {
              const quote = safeParse(r.quoteJson);
              const booking = parseBooking(r.bookingJson);
              const where = [r.address, r.suburb].filter(Boolean).join(", ");
              const what = (quote?.breakdown?.lines ?? []).map((l) => l.label).join(", ");
              return (
                <li key={r.id} className="border-[1.5px] border-charcoal bg-background">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-mintlight/50"
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    aria-expanded={openId === r.id}
                  >
                    <span>
                      <span className="font-bold text-charcoal">
                        <ServiceDots kinds={serviceKinds(quote?.input ?? null)} /> {dateLabel(jobDateOf(r))} — {r.name}
                      </span>
                      <span className="block text-sm text-charcoal/60">
                        {booking?.town || r.suburb || "Location n/a"}
                        {what ? ` · ${what}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="font-display text-xl font-black text-forest">{money(r.total)}</span>
                      <span
                        className={`border px-2 py-0.5 text-xs font-bold uppercase ${
                          r.status === "completed"
                            ? "border-forest bg-mintlight text-forest"
                            : "border-charcoal/40 text-charcoal/60"
                        }`}
                      >
                        {r.status}
                      </span>
                    </span>
                  </button>
                  {openId === r.id && (
                    <div className="border-t-[1.5px] border-charcoal/20 p-4 text-sm">
                      <p>
                        <strong>Phone:</strong>{" "}
                        <a href={`tel:${r.phone}`} className="text-forest">{r.phone}</a>
                        {" · "}
                        <strong>Email:</strong>{" "}
                        <a href={`mailto:${r.email}`} className="text-forest">{r.email}</a>
                      </p>
                      {where && <p className="mt-1"><strong>Address:</strong> {where}</p>}
                      <p className="mt-1">
                        <strong>Job date:</strong> {dateLabel(jobDateOf(r))}
                        {booking?.rugPickup
                          ? " · 3–5 PM rug run"
                          : booking?.preferredSlot !== null && booking?.preferredSlot !== undefined
                            ? ` · ${TIME_SLOTS[booking.preferredSlot]}`
                            : " · time to arrange"}
                      </p>
                      <p className="mt-1">
                        <strong>Sent in:</strong>{" "}
                        {new Date(r.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        <strong>Paid online:</strong> {r.paidOnline ? "yes" : "no"}
                      </p>
                      {quote?.breakdown?.lines && (
                        <ul className="mt-3 space-y-1">
                          {quote.breakdown.lines.map((l, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{l.label}</span>
                              <span>{money(l.amount)}</span>
                            </li>
                          ))}
                          <li className="flex justify-between border-t pt-1">
                            <span>Travel</span>
                            <span>{money(quote.breakdown.travelFee)}</span>
                          </li>
                          <li className="flex justify-between font-bold">
                            <span>Total</span>
                            <span>{money(r.total)}</span>
                          </li>
                        </ul>
                      )}
                      {booking?.notes && <p className="mt-2"><strong>Notes:</strong> {booking.notes}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  function Clients() {
    const leads = trpc.admin.listLeads.useQuery();
    const [q, setQ] = useState("");
    const [openKey, setOpenKey] = useState<string | null>(null);
    if (leads.isPending) return <p>Loading…</p>;
    const rows = leads.data ?? [];
    type Row = (typeof rows)[number];

    const byClient = new Map<string, Row[]>();
    for (const r of rows) {
      const key = (r.email || r.phone || `lead-${r.id}`).trim().toLowerCase();
      byClient.set(key, [...(byClient.get(key) ?? []), r]);
    }
    const clients = [...byClient.entries()]
      .map(([key, list]) => {
        const newestFirst = list.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        const latest = newestFirst[0];
        const jobsBooked = list.filter((r) => parseBooking(r.bookingJson)?.preferredDate).length;
        return {
          key,
          name: latest.name,
          email: latest.email,
          phone: latest.phone,
          address: [latest.address, latest.suburb].filter(Boolean).join(", "),
          quotes: list.length,
          jobsBooked,
          totalValue: list.reduce((sum, r) => sum + (r.total ?? 0), 0),
          lastDate: latest.createdAt,
          list: newestFirst,
        };
      })
      .sort((a, b) => +new Date(b.lastDate) - +new Date(a.lastDate));

    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? clients.filter((c) => [c.name, c.email, c.phone, c.address].join(" ").toLowerCase().includes(needle))
      : clients;

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-charcoal">
            Clients ({filtered.length})
          </h2>
          <button
            type="button"
            className="btn-pill-dark !px-5 !py-2 text-sm"
            onClick={() =>
              downloadCsv(
                "clients.csv",
                filtered.map((c) => ({
                  name: c.name,
                  phone: c.phone,
                  email: c.email,
                  address: c.address,
                  quotes: c.quotes,
                  jobsBooked: c.jobsBooked,
                  totalValue: c.totalValue,
                  lastContact: new Date(c.lastDate).toLocaleDateString("en-AU"),
                })),
              )
            }
          >
            Export CSV
          </button>
        </div>
        <p className="mt-1 text-sm text-charcoal/70">
          Everyone who's ever sent a quote, saved with their details — one card per customer,
          all their jobs underneath.
        </p>
        <input
          type="search"
          className="input-sharp mt-4"
          placeholder="Search clients…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search clients"
        />

        {filtered.length === 0 ? (
          <p className="mt-6 text-charcoal/70">
            {clients.length === 0 ? "No clients yet — they appear here from their first quote." : "No matches."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((c) => (
              <li key={c.key} className="border-[1.5px] border-charcoal bg-background">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-mintlight/50"
                  onClick={() => setOpenKey(openKey === c.key ? null : c.key)}
                  aria-expanded={openKey === c.key}
                >
                  <span>
                    <span className="font-bold text-charcoal">{c.name}</span>
                    <span className="block text-sm text-charcoal/60">
                      {c.address || c.email}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-bold text-charcoal">
                      {c.jobsBooked} job{c.jobsBooked === 1 ? "" : "s"} booked · {c.quotes} quote{c.quotes === 1 ? "" : "s"}
                    </span>
                    <span className="block text-charcoal/60">
                      {money(c.totalValue)} all up · last{" "}
                      {new Date(c.lastDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                </button>
                {openKey === c.key && (
                  <div className="border-t-[1.5px] border-charcoal/20 p-4 text-sm">
                    <p>
                      <strong>Phone:</strong>{" "}
                      <a href={`tel:${c.phone}`} className="text-forest">{c.phone}</a>
                      {" · "}
                      <strong>Email:</strong>{" "}
                      <a href={`mailto:${c.email}`} className="text-forest">{c.email}</a>
                    </p>
                    {c.address && <p className="mt-1"><strong>Address:</strong> {c.address}</p>}
                    <p className="mt-3 font-bold text-charcoal">Their jobs & quotes</p>
                    <ul className="mt-2 space-y-2">
                      {c.list.map((r) => {
                        const b = parseBooking(r.bookingJson);
                        const quote = safeParse(r.quoteJson);
                        const what = (quote?.breakdown?.lines ?? []).map((l) => l.label).join(", ");
                        return (
                          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-charcoal/10 pb-2">
                            <span>
                              <strong>
                                {new Date((b?.preferredDate ?? new Date(r.createdAt).toLocaleDateString("en-CA")) + "T12:00:00")
                                  .toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                              </strong>
                              <span className="text-charcoal/60">
                                {" "}· MCC-{String(r.id).padStart(4, "0")} · {what || "quote"} · {r.status}
                              </span>
                            </span>
                            <span className="font-bold text-forest">{money(r.total)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function Settings() {
    const smtp = trpc.admin.getSmtpSettings.useQuery();
    const stripe = trpc.admin.getStripeSettings.useQuery();
    const [form, setForm] = useState<Record<string, string> | null>(null);
    const [stripeKey, setStripeKey] = useState("");
    const [pw, setPw] = useState({ current: "", next: "" });
    const [msg, setMsg] = useState("");
    const [smtpMsg, setSmtpMsg] = useState("");
    const [smtpErr, setSmtpErr] = useState("");
    const [stripeMsg, setStripeMsg] = useState("");
    const saveStripe = trpc.admin.saveStripeSettings.useMutation({
      onSuccess: async () => {
        // Prove it: read the Stripe state straight back from the server.
        const fresh = await utils.admin.getStripeSettings.fetch();
        utils.admin.getStripeSettings.invalidate();
        setStripeKey("");
        setStripeMsg(fresh?.configured
          ? "Saved ✓ — checked and locked in. Card payments are ON: customers can now pay online when they book."
          : "Couldn't confirm the save — press Save once more.");
      },
      onError: (e) => setStripeMsg(e.message),
    });
    const save = trpc.admin.saveSmtpSettings.useMutation({
      onSuccess: async (_r, v) => {
        // Prove it: read the settings straight back and compare.
        const fresh = await utils.admin.getSmtpSettings.fetch();
        utils.admin.getSmtpSettings.invalidate();
        utils.admin.stats.invalidate();
        const ok = !!fresh &&
          fresh.smtp_host === v.smtp_host &&
          fresh.smtp_port === v.smtp_port &&
          fresh.smtp_user === v.smtp_user &&
          fresh.smtp_from === v.smtp_from;
        if (ok) {
          setSmtpMsg("Saved ✓ — checked against the server and locked in.");
          setSmtpErr("");
        } else {
          setSmtpMsg("");
          setSmtpErr("Couldn't confirm the save — press Save email settings once more.");
        }
      },
      onError: (e) => { setSmtpMsg(""); setSmtpErr(e.message); },
    });
    const test = trpc.admin.testSmtp.useMutation({
      onSuccess: () => { setSmtpMsg(`Test email sent to ${BUSINESS.email} — check your inbox.`); setSmtpErr(""); },
      onError: (e) => { setSmtpMsg(""); setSmtpErr(e.message); },
    });
    const changePw = trpc.admin.changePassword.useMutation({
      onSuccess: () => {
        setMsg("Saved ✓ — password changed. Use the new one next time you sign in.");
        setPw({ current: "", next: "" });
      },
      onError: (e) => setMsg(e.message),
    });
    const messaging = trpc.admin.getMessagingSettings.useQuery();
    const gallery = trpc.public.gallery.useQuery();
    const [gCaption, setGCaption] = useState("");
    const [gSuburb, setGSuburb] = useState("");
    const [gBefore, setGBefore] = useState<string | null>(null);
    const [gAfter, setGAfter] = useState<string | null>(null);
    const [gMsg, setGMsg] = useState("");
    const addPhoto = trpc.admin.addGalleryItem.useMutation({
      onSuccess: () => {
        utils.public.gallery.invalidate();
        setGCaption(""); setGSuburb(""); setGBefore(null); setGAfter(null);
        setGMsg("Saved ✓ — the pair is live on the Our work page.");
      },
      onError: (e) => setGMsg(e.message),
    });
    const removePhoto = trpc.admin.removeGalleryItem.useMutation({
      onSuccess: () => utils.public.gallery.invalidate(),
      onError: (e) => setGMsg(e.message),
    });
    const pickPhoto = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      resizeImage(file).then(setter).catch(() => setGMsg("Couldn't read that image — try a JPEG or PNG."));
    };
    const [mform, setMform] = useState<Record<string, string> | null>(null);
    const [mMsg, setMMsg] = useState("");
    const saveMessaging = trpc.admin.saveMessagingSettings.useMutation({
      onSuccess: async (_r, v) => {
        // Prove it: read the message settings straight back and compare.
        const fresh = await utils.admin.getMessagingSettings.fetch();
        utils.admin.getMessagingSettings.invalidate();
        const ok = !!fresh &&
          fresh.google_review_url === v.google_review_url &&
          fresh.twilio_sid === v.twilio_sid &&
          fresh.twilio_from === v.twilio_from;
        setMMsg(ok
          ? "Saved ✓ — checked against the server and locked in. Confirmations and thank-you messages use these from the next send."
          : "Couldn't confirm the save — press Save message settings once more.");
      },
      onError: (e) => setMMsg(e.message),
    });
    const mf = mform ?? (messaging.data
      ? {
          google_review_url: messaging.data.google_review_url,
          twilio_sid: messaging.data.twilio_sid,
          twilio_from: messaging.data.twilio_from,
          twilio_token: "",
        }
      : null);

    const f = form ?? (smtp.data
      ? {
          // Pre-filled for Gmail — the most likely setup — so there's
          // usually nothing to type but the app password.
          smtp_host: smtp.data.smtp_host || "smtp.gmail.com",
          // Server sends "587" when nothing's saved — treat an empty host
          // as "never configured" and show Gmail's SSL port instead.
          smtp_port: smtp.data.smtp_host ? smtp.data.smtp_port : "465",
          smtp_user: smtp.data.smtp_user || BUSINESS.email,
          smtp_from: smtp.data.smtp_from,
          smtp_pass: "",
        }
      : null);

    return (
      <div className="max-w-2xl space-y-12">
        <Prices />
        <section>
          <h2 className="font-display text-2xl font-black text-charcoal">
            Card payments (Stripe)
          </h2>
          {stripe.data?.configured ? (
            <div className="mt-4 border-[1.5px] border-forest bg-mintlight p-5">
              <p className="font-bold text-forest">
                Card payments are on {stripe.data.keyHint && <span className="text-forest/70">(key {stripe.data.keyHint})</span>}
              </p>
              <p className="mt-1 text-sm text-charcoal/80">
                Customers who pick "pay now" go straight to a secure Stripe checkout for the full
                amount, and paid bookings show a <strong>Paid online</strong> badge in Quote leads.
                Money lands in your Stripe account, then your bank.
              </p>
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStripeMsg("");
                  if (stripeKey.trim()) saveStripe.mutate({ stripe_secret_key: stripeKey.trim() });
                }}
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Replace the key (optional)</span>
                  <input className="input-sharp" type="password" value={stripeKey}
                    placeholder="sk_live_…" onChange={(e) => setStripeKey(e.target.value)}
                    autoComplete="off" />
                </label>
                <button type="submit" className="btn-pill mt-3 !px-5 !py-2.5 text-sm" disabled={saveStripe.isPending || !stripeKey.trim()}>
                  Save new key
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-4 border-[1.5px] border-charcoal bg-cream p-5">
              <p className="font-bold text-charcoal">Not switched on yet — 10 minutes, once.</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-charcoal/80">
                <li>Go to <strong>stripe.com</strong> and create a free account (you'll need your ABN and bank details — that's how you get paid).</li>
                <li>In the Stripe dashboard, click <strong>Developers → API keys</strong>.</li>
                <li>Copy the <strong>Secret key</strong> (starts with <code>sk_live_</code>) and paste it below.</li>
              </ol>
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStripeMsg("");
                  if (stripeKey.trim()) saveStripe.mutate({ stripe_secret_key: stripeKey.trim() });
                }}
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Stripe secret key</span>
                  <input className="input-sharp" type="password" value={stripeKey}
                    placeholder="sk_live_…" onChange={(e) => setStripeKey(e.target.value)}
                    autoComplete="off" />
                </label>
                <button type="submit" className="btn-pill mt-3 !px-5 !py-2.5 text-sm" disabled={saveStripe.isPending || !stripeKey.trim()}>
                  {saveStripe.isPending ? "Checking with Stripe…" : "Save & switch on card payments"}
                </button>
              </form>
              <p className="mt-3 text-sm text-charcoal/70">
                Stripe takes about 1.75% + 30¢ per payment (e.g. about $4.50 on a $250 job).
                Until this is on, "pay now" customers just get a payment link from you instead.
              </p>
            </div>
          )}
          {stripeMsg && (
            <p className={`mt-3 border-[1.5px] p-3 text-sm font-semibold ${stripe.data?.configured || stripeMsg.startsWith("Saved ✓") ? "border-forest bg-mintlight text-forest" : "border-destructive text-destructive"}`} role="status">
              {stripeMsg}
            </p>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-black text-charcoal">
            Newsletter email (SMTP)
          </h2>
          <p className="mt-2 text-charcoal/75">
            For Gmail: turn on 2-Step Verification, then create an{" "}
            <strong>App Password</strong> in your Google account (Security → App passwords)
            and paste it below. It goes in the password field — your real Gmail password
            won't work here.
          </p>
          {smtp.isPending || !f ? (
            <p className="mt-4">Loading…</p>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSmtpMsg("");
                setSmtpErr("");
                save.mutate(f as Parameters<typeof save.mutate>[0]);
              }}
            >
              <p className="mb-4 text-sm text-charcoal/70">
                For Gmail these are already filled in — the only thing you add is an{" "}
                <strong>app password</strong> from your Google account (not your normal Gmail
                password — Google's at{" "}
                <span className="font-semibold text-charcoal">myaccount.google.com → Security → App passwords</span>).
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">SMTP host</span>
                  <input className="input-sharp" value={f.smtp_host}
                    onChange={(e) => setForm({ ...f, smtp_host: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Port</span>
                  <input className="input-sharp" value={f.smtp_port}
                    onChange={(e) => setForm({ ...f, smtp_port: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Email (username)</span>
                <input className="input-sharp" value={f.smtp_user}
                  onChange={(e) => setForm({ ...f, smtp_user: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">From name (optional)</span>
                <input className="input-sharp" value={f.smtp_from}
                  placeholder="Marshall's Carpet Cleaning"
                  onChange={(e) => setForm({ ...f, smtp_from: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">
                  App password {smtp.data?.hasPassword && "(saved — leave blank to keep it)"}
                </span>
                <input className="input-sharp" type="password" value={f.smtp_pass}
                  onChange={(e) => setForm({ ...f, smtp_pass: e.target.value })}
                  autoComplete="new-password" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn-pill !px-5 !py-2.5 text-sm" disabled={save.isPending}>
                  {save.isPending ? "Saving & checking…" : "Save email settings"}
                </button>
                <button
                  type="button"
                  className="btn-pill-dark !px-5 !py-2.5 text-sm"
                  disabled={test.isPending}
                  onClick={() => { setSmtpMsg(""); setSmtpErr(""); test.mutate({ to: BUSINESS.email }); }}
                >
                  {test.isPending ? "Sending…" : "Send test to myself"}
                </button>
              </div>
              {smtpMsg && (
                <p className="border-[1.5px] border-forest bg-mintlight p-3 text-sm font-bold text-forest" role="status">
                  {smtpMsg}
                </p>
              )}
              {smtpErr && (
                <p className="border-[1.5px] border-destructive p-3 text-sm font-semibold text-destructive" role="alert">
                  {smtpErr}
                </p>
              )}
            </form>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-black text-charcoal">Customer messages</h2>
          <p className="mt-2 text-sm text-charcoal/70">
            Every booking gets a confirmation the moment it lands, and a thank-you with your review
            link 30 minutes after the job ends — sent by email, text, or both, however the customer
            asked. Email uses the Gmail settings above. Text messages need a Twilio account (about
            $6/month plus a few cents a text) — until then the booking form simply confirms by
            email. The moment you save Twilio settings here, the "text me" option appears on the
            booking form by itself.
          </p>
          {mf && (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setMMsg("");
                saveMessaging.mutate({
                  google_review_url: mf.google_review_url,
                  twilio_sid: mf.twilio_sid,
                  twilio_from: mf.twilio_from,
                  twilio_token: mf.twilio_token || undefined,
                });
              }}
            >
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Google review link</span>
                <input
                  className="input-sharp"
                  value={mf.google_review_url}
                  placeholder="https://g.page/r/…"
                  onChange={(e) => setMform({ ...mf, google_review_url: e.target.value })}
                />
                <span className="mt-1 block text-xs text-charcoal/60">
                  Google Business Profile → "Ask for reviews" → copy the link. It's what goes in the
                  thank-you message after each job.
                </span>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Twilio Account SID (for SMS)</span>
                  <input
                    className="input-sharp"
                    value={mf.twilio_sid}
                    placeholder="AC…"
                    onChange={(e) => setMform({ ...mf, twilio_sid: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Twilio phone number</span>
                  <input
                    className="input-sharp"
                    value={mf.twilio_from}
                    placeholder="+61…"
                    onChange={(e) => setMform({ ...mf, twilio_from: e.target.value })}
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">
                  Twilio auth token {messaging.data?.hasTwilioToken && "(saved — leave blank to keep it)"}
                </span>
                <input
                  className="input-sharp"
                  type="password"
                  value={mf.twilio_token}
                  onChange={(e) => setMform({ ...mf, twilio_token: e.target.value })}
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" className="btn-pill !px-5 !py-2.5 text-sm" disabled={saveMessaging.isPending}>
                {saveMessaging.isPending ? "Saving & checking…" : "Save message settings"}
              </button>
              {mMsg && (
                <p className={`border-[1.5px] p-3 text-sm font-bold ${mMsg.startsWith("Saved ✓") ? "border-forest bg-mintlight text-forest" : "border-destructive text-destructive"}`} role="status">
                  {mMsg}
                </p>
              )}
            </form>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-black text-charcoal">Job photos — before &amp; after</h2>
          <p className="mt-2 text-sm text-charcoal/70">
            These power the <a href="/work" className="font-bold text-forest">Our work</a> page.
            Snap a "before" when you arrive and an "after" when you're done, then add the pair here —
            photos are resized automatically on upload, newest pair shows first.
          </p>
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Before photo</span>
                <input type="file" accept="image/*" className="input-sharp" onChange={pickPhoto(setGBefore)} />
                {gBefore && <img src={gBefore} alt="Before preview" className="mt-2 aspect-[4/3] w-full border-[1.5px] border-charcoal object-cover" />}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">After photo</span>
                <input type="file" accept="image/*" className="input-sharp" onChange={pickPhoto(setGAfter)} />
                {gAfter && <img src={gAfter} alt="After preview" className="mt-2 aspect-[4/3] w-full border-[1.5px] border-charcoal object-cover" />}
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Caption (optional)</span>
                <input className="input-sharp" value={gCaption} placeholder="Lounge room — end of lease"
                  onChange={(e) => setGCaption(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Suburb (optional)</span>
                <input className="input-sharp" value={gSuburb} placeholder="Armidale"
                  onChange={(e) => setGSuburb(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              className="btn-pill !px-5 !py-2.5 text-sm"
              disabled={addPhoto.isPending || !gBefore || !gAfter}
              onClick={() => {
                setGMsg("");
                if (gBefore && gAfter)
                  addPhoto.mutate({ caption: gCaption, suburb: gSuburb, beforeDataUrl: gBefore, afterDataUrl: gAfter });
              }}
            >
              {addPhoto.isPending ? "Uploading…" : "Add this pair to the gallery"}
            </button>
            {gMsg && (
              <p className={`border-[1.5px] p-3 text-sm font-bold ${gMsg.startsWith("Saved ✓") ? "border-forest bg-mintlight text-forest" : "border-destructive text-destructive"}`} role="status">
                {gMsg}
              </p>
            )}
            {(gallery.data ?? []).length > 0 && (
              <ul className="grid gap-4 md:grid-cols-3">
                {(gallery.data ?? []).map((p) => (
                  <li key={p.id} className="border-[1.5px] border-charcoal bg-background p-2">
                    <div className="grid grid-cols-2 gap-1">
                      <img src={`/gallery/${p.before}`} alt="Before" className="aspect-square w-full object-cover" />
                      <img src={`/gallery/${p.after}`} alt="After" className="aspect-square w-full object-cover" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-charcoal">{p.caption || "Before & after"}{p.suburb ? ` — ${p.suburb}` : ""}</p>
                    <button
                      type="button"
                      className="mt-1 text-sm font-bold text-destructive underline"
                      disabled={removePhoto.isPending}
                      onClick={() => removePhoto.mutate({ id: p.id })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-black text-charcoal">Admin password</h2>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setMsg("");
              changePw.mutate(pw);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Current password</span>
              <input className="input-sharp max-w-sm" type="password" value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">New password (8+ characters)</span>
              <input className="input-sharp max-w-sm" type="password" value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
            </label>
            <button type="submit" className="btn-pill !px-5 !py-2.5 text-sm" disabled={changePw.isPending}>
              Change password
            </button>
          </form>
        </section>

        {msg && (
          <p className={`border-[1.5px] p-4 font-semibold ${msg.startsWith("Saved ✓") ? "border-forest bg-mintlight text-forest" : "border-destructive text-destructive"}`} role="status">
            {msg}
          </p>
        )}
      </div>
    );
  }
}

/** Resize a picked photo to max 1200px JPEG before upload — keeps payloads small. */
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

function safeParse(json: string): {
  input?: QuoteInput;
  breakdown?: { lines: { label: string; amount: number }[]; travelFee: number };
} | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseBooking(json: string | null): Partial<BookingDetails> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Partial<BookingDetails>;
  } catch {
    return null;
  }
}
