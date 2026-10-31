const ITEMS = [
  "Carpet steam cleaning",
  "Upholstery & lounges",
  "Mattress cleaning",
  "End of lease",
  "Stain treatment",
  "Rug pick-up & clean",
  "Armidale",
  "Uralla",
  "Guyra",
  "Walcha",
];

export default function Ticker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y-[1.5px] border-charcoal bg-foreground py-3" aria-hidden="true">
      <div className="marquee-track flex w-max items-center whitespace-nowrap">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center">
            {row.map((item, i) => (
              <span
                key={`${half}-${i}`}
                className="px-6 font-display text-lg font-bold text-mint"
              >
                {item}
                <span className="pl-12 not-italic text-cream">—</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
