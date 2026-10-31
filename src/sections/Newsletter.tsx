import NewsletterForm from "@/components/NewsletterForm";

export default function Newsletter() {
  return (
    <section className="bg-creamlight py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-widest text-forest">
            The monthly clean-deals email
          </p>
          <h2 className="mt-3 font-display text-4xl font-black leading-tight text-charcoal md:text-5xl">
            10% off now. Better deals every month.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-charcoal/80">
            Join the list and take <strong>WELCOME10</strong> into your first quote for
            10% off. After that: one email a month with subscriber-only discounts,
            seasonal reminders and first crack at end-of-month slots. No spam —
            unsubscribe any time.
          </p>
          <div className="mt-8">
            <NewsletterForm source="newsletter-section" />
          </div>
        </div>
      </div>
    </section>
  );
}
