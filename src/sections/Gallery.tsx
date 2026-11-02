// Recent work — the before/after gallery. Photos are uploaded from
// Admin → Settings (Ben's job photos); each pair gets a drag-to-compare
// slider. Hidden politely while there are no photos yet.
import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";

function CompareSlider({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden border-[1.5px] border-charcoal bg-background">
      <img src={after} alt={`${alt} — after`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <img
        src={before}
        alt={`${alt} — before`}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      {/* divider handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -left-[1px] w-[2px] bg-background" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 border-[1.5px] border-charcoal bg-background px-2 py-1 text-xs font-black text-charcoal">
          ⇔
        </div>
      </div>
      <span className="pointer-events-none absolute left-2 top-2 border-[1.5px] border-charcoal bg-background px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-charcoal">
        Before
      </span>
      <span className="pointer-events-none absolute right-2 top-2 border-[1.5px] border-charcoal bg-forest px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-background">
        After
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Drag to compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

export default function Gallery() {
  const items = trpc.public.gallery.useQuery(undefined, { staleTime: 10 * 60 * 1000, retry: 1 });
  const photos = items.data ?? [];

  return (
    <section className="bg-creamlight py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">Recent work</p>
        <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-6xl">
          See the difference.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-charcoal/80">
          Real jobs from around Armidale &amp; the New England — where there's a
          before shot, drag the slider to compare.
        </p>

        {photos.length === 0 ? (
          <div className="mt-10 border-[1.5px] border-charcoal bg-background p-8 text-center md:p-12">
            <p className="font-display text-2xl font-black text-charcoal">Photos coming soon.</p>
            <p className="mx-auto mt-3 max-w-md text-charcoal/75">
              We're out on jobs every week — fresh before/after shots land here as we go. In the
              meantime, the price works the same either way:
            </p>
            <Link to="/quote" className="btn-pill mt-6 inline-block no-underline">
              Book your clean.
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {photos.map((p) => (
              <figure key={p.id}>
                {p.after ? (
                  <CompareSlider
                    before={`/gallery/${p.before}`}
                    after={`/gallery/${p.after}`}
                    alt={p.caption || "Carpet cleaning result"}
                  />
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden border-[1.5px] border-charcoal bg-background">
                    <img
                      src={`/gallery/${p.before}`}
                      alt={p.caption || "Finished cleaning job"}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="pointer-events-none absolute right-2 top-2 border-[1.5px] border-charcoal bg-forest px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-background">
                      After
                    </span>
                  </div>
                )}
                <figcaption className="mt-2 flex items-baseline justify-between gap-3">
                  <span className="font-bold text-charcoal">{p.caption || (p.after ? "Before & after" : "Finished job")}</span>
                  {p.suburb && (
                    <span className="shrink-0 text-sm font-semibold text-charcoal/60">{p.suburb}</span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {photos.length > 0 && (
          <div className="mt-10 text-center">
            <p className="text-lg text-charcoal/80">Want yours to look like the "after"?</p>
            <Link to="/quote" className="btn-pill mt-4 inline-block no-underline">
              Book your clean.
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
