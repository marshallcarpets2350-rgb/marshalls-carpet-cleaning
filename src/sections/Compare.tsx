import { BUSINESS, BFYB_MODEL, RATES, carpetStandardForArea, money, type BfybModel } from "@contracts/rates";
import { trpc } from "@/providers/trpc";

// Fallback if the price-watch report hasn't landed yet — the live "checked"
// date comes from the daily 6 AM check of BFYB's own booking config.
const CHECKED_FALLBACK = "19 October 2026";

type CompanyKey = "ours" | "bfyb" | "electrodry";

const COMPANIES: { key: CompanyKey; name: string; sub: string }[] = [
  { key: "ours", name: "Marshall's", sub: "that's us" },
  { key: "bfyb", name: "BFYB", sub: "Armidale local" },
  { key: "electrodry", name: "Electrodry", sub: "franchise" },
];

// Four standard 13m² bedrooms at our published light-soiling rate — the same
// job Electrodry's "$259, 3 rooms + 4th free" special covers (max 13m²/room).
const FOUR_BEDROOMS_OURS = Math.round(carpetStandardForArea(13 * 4));

// BFYB cells price off the live model the daily watch maintains — when their
// numbers move, this table moves the same morning.
function rowsFor(m: BfybModel): {
  label: string;
  note?: string;
  cells: Record<CompanyKey, string>;
}[] {
  const travelFees = Object.values(m.travelByTown).filter((f) => f > 0);
  const travelLo = Math.min(...travelFees);
  const travelHi = Math.max(...travelFees);
  return [
  {
    label: "Advertised starting price",
    note: "The cheapest number they'll put in writing.",
    cells: {
      ours: `${money(RATES.minimumCharge)} minimum`,
      bfyb: `${money(m.minimum)} minimum`,
      electrodry: `${money(219)} special*`,
    },
  },
  {
    label: "4 standard bedrooms",
    note: "Same 13m²-per-room job at each published rate.",
    cells: {
      ours: money(FOUR_BEDROOMS_OURS),
      bfyb: `${money(m.minimum)} — their minimum`,
      electrodry: `${money(259)} special*`,
    },
  },
  {
    label: "Lounge cleaning, per seat",
    cells: {
      ours: `from ${money(RATES.lounge.perSeat.light)}`,
      bfyb: money(m.loungePerSeat),
      electrodry: `≈${money(65)} on special*`,
    },
  },
  {
    label: "Queen mattress",
    cells: {
      ours: money(RATES.mattress.base.queen),
      bfyb: "Not published",
      electrodry: `${money(149)} special*`,
    },
  },
  {
    label: "Pet urine treatment",
    cells: {
      ours: `from ${money(RATES.stainCauseFee["pet-urine"])}`,
      bfyb: `from ${money(m.extras.stain)}`,
      electrodry: `${money(30)}–${money(50)} a spot, ${money(300)} a room`,
    },
  },
  {
    label: "Travel outside Armidale",
    cells: {
      ours: "Flat $30–$120 for Uralla, Guyra, Walcha — else $1/km each way",
      bfyb: `Armidale free, then ${money(travelLo)}–${money(travelHi)} by town`,
      electrodry: "Not published",
    },
  },
  {
    label: "Price before you call",
    note: "Can you get a real number without ringing anyone?",
    cells: {
      ours: "Live calculator, this site",
      bfyb: "Online calculator",
      electrodry: "Postcode specials / call centre",
    },
  },
  ];
}

export default function Compare() {
  const checkedQ = trpc.public.bfybChecked.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const ROWS = rowsFor(checkedQ.data?.model ?? BFYB_MODEL);
  const CHECKED = checkedQ.data?.checkedAt
    ? new Date(checkedQ.data.checkedAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : CHECKED_FALLBACK;
  return (
    <section id="compare" className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="max-w-2xl font-display text-4xl font-black leading-tight text-charcoal md:text-5xl">
          The three names in Armidale carpet cleaning, side by side.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal/75">
          Bang For Ya Buck and Electrodry are the other two names you'll find. Here's
          what each company publishes, checked {CHECKED} — same jobs, same room
          sizes, their own advertised numbers against ours. Every other cleaner in
          the region publishes nothing at all.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[680px] border-[1.5px] border-charcoal bg-background">
            <thead>
              <tr className="border-b-[1.5px] border-charcoal bg-creamlight text-left">
                <th className="p-4 font-bold text-charcoal"></th>
                {COMPANIES.map((c) => (
                  <th
                    key={c.key}
                    className={`p-4 font-bold ${
                      c.key === "ours" ? "bg-foreground text-mint" : "text-charcoal"
                    }`}
                  >
                    {c.name}
                    <span
                      className={`block text-xs font-normal ${
                        c.key === "ours" ? "text-background/60" : "text-charcoal/50"
                      }`}
                    >
                      {c.sub}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-charcoal/15 align-top">
                  <th className="p-4 text-left font-semibold text-charcoal">
                    {r.label}
                    {r.note && (
                      <span className="block text-sm font-normal text-charcoal/60">{r.note}</span>
                    )}
                  </th>
                  {COMPANIES.map((c) => (
                    <td
                      key={c.key}
                      className={
                        c.key === "ours"
                          ? "bg-foreground p-4 font-display text-lg font-black text-mint"
                          : "p-4 text-sm text-charcoal/70"
                      }
                    >
                      {r.cells[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-charcoal/60">
          *Electrodry figures are the specials published on Electrodry's own website,
          checked {CHECKED}. Electrodry is a franchise and pricing varies by area —
          enter your postcode on their site or call 13&nbsp;27&nbsp;13 to confirm the
          Armidale franchise's current offer. Conditions apply: rooms capped at
          13m², stains may cost extra, minimum service charges apply. BFYB figures
          are from their own online quote calculator at bangforyabuck.com.au, run
          with these exact jobs on {CHECKED} — their site publishes no rate card.
          "Not published" means no price appeared on their website on that date —
          not that one doesn't exist.
        </p>

        <div className="offset-shadow mt-12 border-[1.5px] border-charcoal bg-foreground p-8 text-background md:p-10">
          <p className="font-display text-3xl font-black leading-tight md:text-4xl">
            Found a cheaper written quote for the same job?
            <span className="text-mint"> We'll beat it.</span>
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-background/80">
            Show us any genuine written quote from another carpet cleaner —
            including an advertised special like the ones above — and he'll beat it
            for the same work. That's the deal while we're building the book. Call{" "}
            <a href={BUSINESS.phoneHref} className="font-bold text-mint no-underline hover:underline">
              {BUSINESS.phone}
            </a>{" "}
            before you book anyone else.
          </p>
          <p className="mt-4 text-sm text-background/50">
            Applies to genuine written quotes and advertised specials for the same
            job scope, within our service area. Commercial jobs over 300m² are
            quoted by negotiation.
          </p>
        </div>
      </div>
    </section>
  );
}
