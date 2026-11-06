// Admin → New quote. Ben prices a job for someone (phone call, doorstep,
// real estate agent) and saves it WITHOUT a booking date — no calendar slot
// is blocked and no customer emails fire. It lands in Jobs with a "Quote
// only" badge, ready to book in when the customer says yes.
import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useRates } from "@/lib/useRates";
import {
  computeQuote,
  travelFeeForTown,
  money,
  BFYB_MODEL,
  RUG_SIZES,
  type Dirtiness,
  type LoungeItem,
  type MattressItem,
  type QuoteInput,
  type RugItem,
  type StainType,
} from "@contracts/rates";

const inputCls = "input-sharp";
const labelCls = "mb-1 block text-sm font-bold text-charcoal";

const DIRTINESS: { id: Dirtiness; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
];

const MATTRESS_SIZES = ["single", "double", "queen", "king"] as const;
const STAIN_TYPES: { id: StainType; label: string }[] = [
  { id: "pet-urine", label: "Pet urine" },
  { id: "food-drink", label: "Food & drink" },
  { id: "mud-traffic", label: "Mud & traffic" },
  { id: "not-sure", label: "Not sure" },
];

const TOWNS = ["Armidale", "Uralla", "Guyra", "Walcha"];

function DirtinessPicker({
  value,
  onChange,
}: {
  value: Dirtiness;
  onChange: (d: Dirtiness) => void;
}) {
  return (
    <div className="flex gap-1">
      {DIRTINESS.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          className={`border-[1.5px] px-3 py-1 text-xs font-bold ${
            value === d.id
              ? "border-charcoal bg-charcoal text-background"
              : "border-charcoal/40 text-charcoal/70 hover:border-charcoal"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

export default function NewQuote() {
  const rates = useRates();
  const utils = trpc.useUtils();

  // Who it's for
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [town, setTown] = useState("Armidale");
  const [notes, setNotes] = useState("");

  // What they need
  const [carpetAreaM2, setCarpetAreaM2] = useState(0);
  const [carpetDirtiness, setCarpetDirtiness] = useState<Dirtiness>("light");
  const [lounges, setLounges] = useState<LoungeItem[]>([]);
  const [mattresses, setMattresses] = useState<MattressItem[]>([]);
  const [rugs, setRugs] = useState<RugItem[]>([]);
  const [stainPackage, setStainPackage] = useState(false);
  const [dirtGum, setDirtGum] = useState(false);
  const [enzymePreSpray, setEnzymePreSpray] = useState(false);
  const [stainTypes, setStainTypes] = useState<StainType[]>([]);

  const [saved, setSaved] = useState<{ reference: string; total: number } | null>(null);

  const quoteInput: QuoteInput = useMemo(
    () => ({
      carpetAreaM2,
      carpetDirtiness,
      maintenance: "none",
      lounges,
      mattresses,
      rugs,
      stainPackage,
      dirtGum,
      enzymePreSpray,
      stainTypes,
      preVacuumRooms: 0,
      dryingFans: 0,
      travelFee: travelFeeForTown(town, 0, rates),
      discountPercent: 0,
    }),
    [carpetAreaM2, carpetDirtiness, lounges, mattresses, rugs, stainPackage, dirtGum, enzymePreSpray, stainTypes, town, rates],
  );
  const breakdown = useMemo(() => computeQuote(quoteInput, rates, BFYB_MODEL), [quoteInput, rates]);

  const save = trpc.admin.saveQuote.useMutation({
    onSuccess: async (r) => {
      setSaved({ reference: r.reference, total: r.total });
      await utils.admin.listLeads.invalidate();
    },
  });

  const valid = name.trim().length > 0 && !breakdown.isEmpty;

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setAddress(""); setTown("Armidale"); setNotes("");
    setCarpetAreaM2(0); setCarpetDirtiness("light");
    setLounges([]); setMattresses([]); setRugs([]);
    setStainPackage(false); setDirtGum(false); setEnzymePreSpray(false); setStainTypes([]);
    setSaved(null);
  };

  if (saved) {
    return (
      <div className="border-[1.5px] border-charcoal bg-creamlight p-8 text-center">
        <p className="font-display text-2xl font-black text-charcoal">
          Quote saved — {saved.reference}
        </p>
        <p className="mt-2 text-charcoal/70">
          {money(saved.total)} — no date set, no emails sent. It's sitting in Jobs with a
          "Quote only" badge.
        </p>
        <button type="button" className="btn-pill mt-6" onClick={reset}>
          Price another one
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || save.isPending) return;
        save.mutate({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          suburb: town,
          town,
          notes: notes.trim(),
          quote: quoteInput,
        });
      }}
    >
      <div className="border-[1.5px] border-charcoal bg-creamlight p-5">
        <p className="font-bold text-charcoal">Who's it for</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nq-name" className={labelCls}>Name</label>
            <input id="nq-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="nq-phone" className={labelCls}>Phone (optional)</label>
            <input id="nq-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <label htmlFor="nq-email" className={labelCls}>Email (optional)</label>
            <input id="nq-email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </div>
          <div>
            <label htmlFor="nq-town" className={labelCls}>Town</label>
            <select id="nq-town" className={inputCls} value={town} onChange={(e) => setTown(e.target.value)}>
              {TOWNS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="nq-address" className={labelCls}>Address (optional)</label>
          <input id="nq-address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <div className="border-[1.5px] border-charcoal bg-creamlight p-5">
        <p className="font-bold text-charcoal">Carpet</p>
        <div className="mt-3 grid items-end gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="nq-area" className={labelCls}>Carpet area (m²) — 0 for none</label>
            <input
              id="nq-area"
              className={inputCls}
              type="number"
              min={0}
              max={2000}
              value={carpetAreaM2 || ""}
              onChange={(e) => setCarpetAreaM2(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
            />
          </div>
          {carpetAreaM2 > 0 && (
            <div>
              <span className={labelCls}>How dirty</span>
              <DirtinessPicker value={carpetDirtiness} onChange={setCarpetDirtiness} />
            </div>
          )}
        </div>
      </div>

      <div className="border-[1.5px] border-charcoal bg-creamlight p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold text-charcoal">Lounges & upholstery</p>
          <button
            type="button"
            className="btn-pill-dark !px-4 !py-1.5 text-xs"
            onClick={() => setLounges((p) => [...p, { seats: 3, dirtiness: "light", reclinerSeats: 0 }])}
          >
            + Add lounge
          </button>
        </div>
        {lounges.length === 0 && <p className="mt-2 text-sm text-charcoal/50">None</p>}
        <div className="mt-3 space-y-3">
          {lounges.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 border border-charcoal/20 bg-background p-3">
              <div>
                <span className={labelCls}>Seats</span>
                <select
                  className={inputCls}
                  value={l.seats}
                  onChange={(e) =>
                    setLounges((p) => p.map((x, j) => (j === i ? { ...x, seats: Number(e.target.value) } : x)))
                  }
                >
                  {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>{n}-seater</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Recliners</span>
                <select
                  className={inputCls}
                  value={l.reclinerSeats}
                  onChange={(e) =>
                    setLounges((p) => p.map((x, j) => (j === i ? { ...x, reclinerSeats: Number(e.target.value) } : x)))
                  }
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>How dirty</span>
                <DirtinessPicker
                  value={l.dirtiness}
                  onChange={(d) => setLounges((p) => p.map((x, j) => (j === i ? { ...x, dirtiness: d } : x)))}
                />
              </div>
              <button
                type="button"
                className="ml-auto text-sm font-bold text-[#B91C1C] underline"
                onClick={() => setLounges((p) => p.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-[1.5px] border-charcoal bg-creamlight p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold text-charcoal">Mattresses</p>
          <button
            type="button"
            className="btn-pill-dark !px-4 !py-1.5 text-xs"
            onClick={() => setMattresses((p) => [...p, { size: "queen", dirtiness: "light", qty: 1 }])}
          >
            + Add mattress
          </button>
        </div>
        {mattresses.length === 0 && <p className="mt-2 text-sm text-charcoal/50">None</p>}
        <div className="mt-3 space-y-3">
          {mattresses.map((m, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 border border-charcoal/20 bg-background p-3">
              <div>
                <span className={labelCls}>Size</span>
                <select
                  className={inputCls}
                  value={m.size}
                  onChange={(e) =>
                    setMattresses((p) => p.map((x, j) => (j === i ? { ...x, size: e.target.value as MattressItem["size"] } : x)))
                  }
                >
                  {MATTRESS_SIZES.map((s) => (
                    <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Qty</span>
                <select
                  className={inputCls}
                  value={m.qty}
                  onChange={(e) =>
                    setMattresses((p) => p.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))
                  }
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>How dirty</span>
                <DirtinessPicker
                  value={m.dirtiness}
                  onChange={(d) => setMattresses((p) => p.map((x, j) => (j === i ? { ...x, dirtiness: d } : x)))}
                />
              </div>
              <button
                type="button"
                className="ml-auto text-sm font-bold text-[#B91C1C] underline"
                onClick={() => setMattresses((p) => p.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-[1.5px] border-charcoal bg-creamlight p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold text-charcoal">Rugs (pick-up & clean)</p>
          <button
            type="button"
            className="btn-pill-dark !px-4 !py-1.5 text-xs"
            onClick={() => setRugs((p) => [...p, { size: "m", qty: 1 }])}
          >
            + Add rugs
          </button>
        </div>
        {rugs.length === 0 && <p className="mt-2 text-sm text-charcoal/50">None</p>}
        <div className="mt-3 space-y-3">
          {rugs.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 border border-charcoal/20 bg-background p-3">
              <div>
                <span className={labelCls}>Size</span>
                <select
                  className={inputCls}
                  value={r.size}
                  onChange={(e) =>
                    setRugs((p) => p.map((x, j) => (j === i ? { ...x, size: e.target.value as RugItem["size"] } : x)))
                  }
                >
                  {RUG_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label} ({s.area}) — ${rates.rugPrices[s.id]}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Qty</span>
                <select
                  className={inputCls}
                  value={r.qty}
                  onChange={(e) =>
                    setRugs((p) => p.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))
                  }
                >
                  {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="ml-auto text-sm font-bold text-[#B91C1C] underline"
                onClick={() => setRugs((p) => p.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-[1.5px] border-charcoal bg-creamlight p-5">
        <p className="font-bold text-charcoal">Extras & stains</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["Stain package", stainPackage, setStainPackage],
              ["Dirt & gum", dirtGum, setDirtGum],
              ["Enzyme pre-spray", enzymePreSpray, setEnzymePreSpray],
            ] as [string, boolean, (v: boolean) => void][]
          ).map(([label, on, set]) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!on)}
              className={`border-[1.5px] px-3 py-1.5 text-sm font-bold ${
                on ? "border-charcoal bg-charcoal text-background" : "border-charcoal/40 text-charcoal/70 hover:border-charcoal"
              }`}
            >
              {on ? "✓ " : ""}{label}
            </button>
          ))}
        </div>
        {carpetAreaM2 > 0 && (
          <div className="mt-4">
            <span className={labelCls}>Stain types on the carpet (optional)</span>
            <div className="flex flex-wrap gap-2">
              {STAIN_TYPES.map((s) => {
                const on = stainTypes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setStainTypes((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))
                    }
                    className={`border-[1.5px] px-3 py-1.5 text-sm font-bold ${
                      on ? "border-charcoal bg-charcoal text-background" : "border-charcoal/40 text-charcoal/70 hover:border-charcoal"
                    }`}
                  >
                    {on ? "✓ " : ""}{s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="nq-notes" className={labelCls}>Notes (optional — only you see these)</label>
        <textarea
          id="nq-notes"
          className={`${inputCls} min-h-20`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. agent wants it done before the 20th, dog friendly, quoted in person"
        />
      </div>

      <div className="border-[1.5px] border-charcoal bg-charcoal p-5 text-background">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest opacity-70">Quote total</p>
            <p className="font-display text-4xl font-black">{breakdown.isEmpty ? "—" : money(breakdown.total)}</p>
            {breakdown.travelFee > 0 && (
              <p className="mt-1 text-sm opacity-70">includes {money(breakdown.travelFee)} travel</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!valid || save.isPending}
            className="btn-pill !bg-background !text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? "Saving…" : "Save quote — no date"}
          </button>
        </div>
        {!breakdown.isEmpty && (
          <ul className="mt-4 space-y-1 border-t border-background/20 pt-3 text-sm opacity-80">
            {breakdown.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>{l.label}</span>
                <span>{l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {!valid && name.trim().length === 0 && (
          <p className="mt-3 text-sm opacity-70">Add a name and at least one service to save.</p>
        )}
        {save.isError && <p className="mt-3 text-sm font-bold text-red-300">{save.error.message}</p>}
      </div>
    </form>
  );
}
