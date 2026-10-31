import { BUSINESS } from "@contracts/rates";
import NewsletterForm from "@/components/NewsletterForm";
import logo from "@/assets/logo.png";

export default function Footer() {
  return (
    <footer id="contact" className="border-t-[1.5px] border-charcoal bg-charcoal text-background">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <img
              src={logo}
              alt="Marshall's Carpet Cleaning"
              className="h-24 w-auto rounded-lg bg-background/95 p-1"
            />
            <p className="mt-4 max-w-sm leading-relaxed text-background/75">
              Hot water extraction carpet, upholstery and mattress cleaning across
              Armidale and the New England. Locally owned and operated.
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-mint">Talk to us</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href={BUSINESS.phoneHref} className="whitespace-nowrap text-lg font-bold text-background no-underline hover:text-mint">
                  {BUSINESS.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${BUSINESS.email}`}
                  className="break-all text-background/85 no-underline hover:text-mint"
                >
                  {BUSINESS.email}
                </a>
              </li>
              <li className="text-background/75">Armidale NSW 2350</li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-mint">
              Monthly deals, one email
            </h3>
            <div className="mt-4 [&_input]:border-background [&_input]:bg-transparent [&_input]:text-background [&_input]:placeholder:text-background/50">
              <NewsletterForm source="footer" />
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-background/20 pt-8 text-sm text-background/60">
          <p>© {new Date().getFullYear()} Marshall's Carpet Cleaning, Armidale NSW.</p>
          <p>
            Quotes are calculated, not estimated —{" "}
            <a href="/quote" className="text-mint no-underline hover:underline">
              build yours
            </a>
            .{" "}
            <a href="/terms" className="ml-3 text-background/60 no-underline hover:text-mint">
              Terms &amp; conditions
            </a>
            <a href="/admin" className="ml-3 text-background/40 no-underline hover:text-mint">
              Admin
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
