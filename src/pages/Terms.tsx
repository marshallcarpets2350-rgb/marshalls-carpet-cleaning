import { TERMS_HEADER, TERMS_SECTIONS } from "@contracts/terms";
import Header from "@/sections/Header";
import Footer from "@/sections/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">The fine print, in plain English</p>
        <h1 className="mt-2 font-display text-4xl font-black text-charcoal">{TERMS_HEADER.title}</h1>
        <div className="mt-4 border-[1.5px] border-charcoal bg-mintlight p-5 text-sm leading-relaxed text-charcoal">
          <p className="font-bold">{TERMS_HEADER.business}</p>
          <p>{TERMS_HEADER.abn}</p>
          <p>
            Phone{" "}
            <a href={`tel:${TERMS_HEADER.phone.replace(/\s/g, "")}`} className="font-bold text-forest no-underline">
              {TERMS_HEADER.phone}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${TERMS_HEADER.email}`} className="font-bold text-forest no-underline">
              {TERMS_HEADER.email}
            </a>
          </p>
          <p className="mt-1 text-charcoal/60">Last updated: {TERMS_HEADER.updated}</p>
        </div>
        <p className="mt-6 leading-relaxed text-charcoal/80">
          These are the rules we work by — every booking gets a copy attached to its confirmation
          email, so you've always got them on file. Anything unclear, call us and ask.
        </p>

        <div className="mt-10 space-y-10">
          {TERMS_SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-xl font-black text-charcoal">{s.title}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-charcoal/80">
                {s.body.map((part, i) =>
                  typeof part === "string" ? (
                    <p key={i}>{part}</p>
                  ) : (
                    <ul key={i} className="list-disc space-y-1.5 pl-6">
                      {part.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
