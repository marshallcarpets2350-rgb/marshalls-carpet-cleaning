// /thanks — the real confirmation page every customer lands on after booking
// (and after paying by card). Details come from the sessionStorage stash
// written at submit time, so there's no server lookup and no customer data
// in the URL. This URL is also what Google Ads counts as a completed
// booking, so it's only ever reachable by booking — and it's noindexed so
// search engines never list it.
import { useEffect } from "react";
import { Facebook, Instagram } from "lucide-react";
import { Link } from "react-router";
import Header from "@/sections/Header";
import FlowArt from "@/components/FlowArt";
import Footer from "@/sections/Footer";
import NewsletterForm from "@/components/NewsletterForm";
import { BUSINESS, money } from "@contracts/rates";
import { readThanks, whenLine } from "@/lib/bookingThanks";

export default function Thanks() {
  // Never let this page into Google's index — it's a post-booking screen.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const b = readThanks();

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main className="bg-creamlight py-20">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-8 md:p-12">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              {b?.paid ? "Paid — booking locked in" : "Booking received"}
            </p>
            {b ? (
              <>
                <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
                  Thanks {b.firstName} — you're booked in.
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
                  Your reference is{" "}
                  <strong className="font-display text-forest">{b.reference}</strong> and
                  your total is{" "}
                  <strong className="font-display text-forest">{money(b.total)}</strong>.
                </p>
                <p className="mt-3 leading-relaxed text-charcoal/80">{whenLine(b)}</p>
                <p className="mt-3 leading-relaxed text-charcoal/80">
                  {b.paid
                    ? "Paid in full by card — your receipt is on its way to your email."
                    : "A confirmation email is on its way to you now — check the junk folder if it's hiding."}
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
                  Thanks — it's with us.
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
                  Your booking came through and the confirmation email is on its
                  way. Anything look wrong, call{" "}
                  <a className="font-bold text-forest" href={BUSINESS.phoneHref}>
                    {BUSINESS.phone}
                  </a>{" "}
                  and we'll sort it on the spot.
                </p>
              </>
            )}
            <div className="mt-8 border-t-[1.5px] border-charcoal/20 pt-8">
              <h2 className="font-display text-2xl font-black text-charcoal">
                Want the monthly deals too?
              </h2>
              <p className="mt-2 text-charcoal/75">
                One email a month, subscriber-only discounts. Your call.
              </p>
              <div className="mt-4">
                <NewsletterForm source="thanks" />
              </div>
            </div>
            <div className="mt-8 border-t-[1.5px] border-charcoal/20 pt-8">
              <h2 className="font-display text-2xl font-black text-charcoal">
                Keep up to date with our latest deals
              </h2>
              <p className="mt-2 text-charcoal/75">
                Follow us on socials — subscriber discounts, before-and-afters
                and seasonal offers land there first.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="https://www.facebook.com/share/1CbfuAvMDJ/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-pill-dark inline-flex items-center gap-2"
                >
                  <Facebook size={18} strokeWidth={2.2} /> Facebook
                </a>
                <a
                  href="https://www.instagram.com/marshall.carpets2350"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-pill inline-flex items-center gap-2"
                >
                  <Instagram size={18} strokeWidth={2.2} /> Instagram
                </a>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/" className="btn-pill">Back to the site</Link>
              <a href={BUSINESS.phoneHref} className="btn-pill-dark">Call {BUSINESS.phone}</a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
