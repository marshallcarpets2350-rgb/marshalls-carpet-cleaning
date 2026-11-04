import type { ReactNode } from "react";
import Header from "@/sections/Header";
import FlowArt, { DotCreek } from "@/components/FlowArt";
import Footer from "@/sections/Footer";
import NewsletterForm from "@/components/NewsletterForm";
import { BUSINESS } from "@contracts/rates";

export function SectionPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main>{children}</main>
      <DotCreek seed={5309} />
      <Footer />
    </div>
  );
}

export function ContactPage() {
  return (
    <SectionPage>
      <section className="bg-creamlight py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-forest">Contact</p>
          <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-6xl">
            Talk to us.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-charcoal/80">
            You'll talk to the person who'll be doing the clean — and the same
            person stands behind the result.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <a
              href={BUSINESS.phoneHref}
              className="border-[1.5px] border-charcoal bg-background p-6 text-center no-underline transition-transform hover:-translate-y-1"
            >
              <p className="text-sm font-bold uppercase tracking-widest text-charcoal/60">Call or text</p>
              <p className="mt-2 whitespace-nowrap font-display text-2xl font-black text-forest">{BUSINESS.phone}</p>
              <p className="mt-1 text-sm text-charcoal/60">7 days, 7am – 7pm</p>
            </a>
            <a
              href={`mailto:${BUSINESS.email}`}
              className="border-[1.5px] border-charcoal bg-background p-6 text-center no-underline transition-transform hover:-translate-y-1"
            >
              <p className="text-sm font-bold uppercase tracking-widest text-charcoal/60">Email</p>
              <p className="mt-2 break-all font-bold text-forest">{BUSINESS.email}</p>
              <p className="mt-1 text-sm text-charcoal/60">We reply same day</p>
            </a>
            <div className="border-[1.5px] border-charcoal bg-background p-6 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-charcoal/60">Based in</p>
              <p className="mt-2 font-display text-2xl font-black text-charcoal">Armidale</p>
              <p className="mt-1 text-sm text-charcoal/60">NSW 2350 — and the New England</p>
            </div>
          </div>

          <div className="mt-12 border-[1.5px] border-charcoal bg-background p-6 md:p-8">
            <h2 className="font-display text-2xl font-black text-charcoal">
              Monthly deals, one email.
            </h2>
            <p className="mt-2 text-charcoal/70">
              A deal a month, nothing more. No spam, unsubscribe any time.
            </p>
            <div className="mt-4 max-w-md">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </SectionPage>
  );
}
