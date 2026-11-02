// Google reviews — the live rating + review cards, pulled from Google's
// official Places API and cached server-side (the cache refreshes weekly, so
// the stars and count tick up on their own). The whole section hides politely
// until the Google key is saved in Admin → Settings.
import { trpc } from "@/providers/trpc";

/** Google-style gold stars with a fractional fill (e.g. 4.8 shows 80% of the
 *  5th star) — gold on grey, the way Google itself renders them. */
function Stars({ rating, className = "h-5 w-5" }: { rating: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const row = (color: string) => (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={className} fill={color} aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
        </svg>
      ))}
    </div>
  );
  return (
    <div className="relative inline-block" role="img" aria-label={`${rating} out of 5 stars`}>
      {row("#D8D3C8")}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("#FBBC04")}
      </div>
    </div>
  );
}

export default function Reviews() {
  const q = trpc.public.googleReviews.useQuery(undefined, { staleTime: 60 * 60 * 1000, retry: 1 });
  const data = q.data;

  // Nothing to show until Google is connected (or the fetch has never
  // succeeded) — the homepage simply skips the section.
  if (!data || data.userRatingCount === 0) return null;

  const reviews = data.reviews.slice(0, 5);

  return (
    <section className="border-t-[1.5px] border-charcoal bg-background py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-forest">Word of mouth</p>
            <h2 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
              {data.rating.toFixed(1)} stars on Google.
            </h2>
            <p className="mt-3 max-w-xl text-lg text-charcoal/80">
              From {data.userRatingCount} Google review{data.userRatingCount === 1 ? "" : "s"} —
              checked and updated weekly, straight from Google.
            </p>
          </div>
          <div className="border-[1.5px] border-charcoal bg-creamlight px-5 py-4 text-center">
            <Stars rating={data.rating} className="h-7 w-7" />
            <p className="mt-2 font-display text-2xl font-black text-charcoal">
              {data.rating.toFixed(1)}<span className="text-charcoal/50"> / 5</span>
            </p>
            <p className="text-xs font-bold uppercase tracking-widest text-charcoal/60">
              {data.userRatingCount} Google review{data.userRatingCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <figure
                key={`${r.author}-${i}`}
                className="flex flex-col border-[1.5px] border-charcoal bg-creamlight p-5"
              >
                <Stars rating={r.rating} className="h-4 w-4" />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-charcoal/85">
                  “{r.text}”
                </blockquote>
                <figcaption className="mt-4 border-t border-charcoal/20 pt-3 text-sm">
                  <span className="font-bold text-charcoal">{r.author}</span>
                  {r.relativeTime && <span className="text-charcoal/60"> · {r.relativeTime}</span>}
                  <span className="block text-xs font-bold uppercase tracking-widest text-charcoal/50">
                    Google review
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <a
            href={data.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-forest underline underline-offset-4"
          >
            Read all reviews on Google →
          </a>
          <a
            href={data.reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-forest underline underline-offset-4"
          >
            Had a clean? Leave us a review →
          </a>
        </div>
      </div>
    </section>
  );
}
