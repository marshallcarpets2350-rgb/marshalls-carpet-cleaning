import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BUSINESS } from "@contracts/rates";
import logo from "@/assets/logo.webp";
import { FairyLights, LogoMask, PromoTag, SeasonBanner, SeasonalStyles } from "@/components/Seasonal";
import iconCarpet from "@/assets/icons/carpet-cleaning.png";
import iconLounge from "@/assets/icons/lounge.png";
import iconRug from "@/assets/icons/rug-pickup.png";
import iconAreas from "@/assets/icons/areas.png";

type NavItem = { icon?: string; emoji?: string; svg?: ReactNode; label: string; sub?: string; to: string; urgent?: boolean };

/** Flooded house — drawn, not an emoji, so it renders the same everywhere. */
function FloodIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
      aria-hidden="true"
    >
      <path d="M4 10.5 12 3l8 7.5" />
      <path d="M6 8.8V15h12V8.8" />
      <path d="M9.5 15v-3h5v3" />
      <path d="M2.5 18.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M5 21.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" opacity="0.55" />
    </svg>
  );
}

const MAIN_NAV: NavItem[] = [
  { icon: iconCarpet, label: "Carpet Cleaning", sub: "quote", to: "/quote" },
  { icon: iconRug, label: "Rug Pick-Up", sub: "& Clean", to: "/rugs" },
  { icon: iconLounge, label: "Lounge, Mattress", sub: "and Upholstery", to: "/lounge" },
  { svg: <FloodIcon />, label: "Emergency Flood", sub: "24/7 help", to: "/flood", urgent: true },
];

const MORE_NAV: NavItem[] = [
  { emoji: "★", label: "Reviews", to: "/reviews" },
  { emoji: "📸", label: "Our work", to: "/work" },
  { icon: iconAreas, label: "Areas we cover", to: "/areas" },
  { emoji: "❔", label: "FAQ", to: "/faq" },
];

function NavIcon({ item, size }: { item: NavItem; size: string }) {
  if (item.icon)
    return (
      <img
        src={item.icon}
        alt=""
        aria-hidden="true"
        className={`inline-block ${size} object-contain align-middle`}
      />
    );
  if (item.svg)
    return (
      <span aria-hidden="true" className={`inline-block ${size}`}>
        {item.svg}
      </span>
    );
  return <span aria-hidden="true">{item.emoji}</span>;
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-charcoal bg-background/95 backdrop-blur">
      <SeasonalStyles />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2 pl-0 pr-4 md:pl-1 md:pr-6 lg:py-1">
        <Link to="/" className="flex shrink-0 items-end no-underline" aria-label="Marshall's Carpet Cleaning — home">
          <span className="relative inline-block">
            <img
              src={logo}
              alt="Marshall's Carpet Cleaning"
              width="512"
              height="505"
              fetchPriority="high"
              className="h-20 w-auto md:h-40 lg:h-28 xl:h-32"
            />
            <LogoMask />
          </span>
        </Link>

        {/* Red flood pill in the middle of the header on phones/tablets —
            desktop (xl) already carries the red "Emergency flood" nav item. */}
        <div className="flex min-w-0 flex-1 justify-center xl:hidden">
          <Link
            to="/flood"
            className="flex items-center gap-1.5 whitespace-nowrap border-[1.5px] border-[#B91C1C] bg-[#FEF2F2] px-2.5 py-1.5 text-xs font-black text-[#B91C1C] no-underline"
          >
            <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0">
              <FloodIcon />
            </span>
            Flood help 24/7
          </Link>
        </div>

        <nav className="hidden flex-1 items-center xl:flex" aria-label="Main">
          <div className="flex flex-1 items-center justify-evenly">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.to + item.label}
                to={item.to}
                className={`whitespace-nowrap text-center text-lg font-bold leading-tight no-underline hover:text-forest ${
                  item.urgent ? "text-[#B91C1C]" : "text-charcoal"
                }`}
              >
                <span className="mb-1 block">
                  <NavIcon item={item} size="h-9 w-9" />
                </span>
                {item.label}
                {item.sub && (
                  <span className={`block text-sm font-bold ${item.urgent ? "text-[#B91C1C]" : "text-charcoal"}`}>{item.sub}</span>
                )}
              </Link>
            ))}
          </div>

          {/* More + Contact sit together at the right end of the nav */}
          <div className="flex items-center gap-8">
            <div
              className="relative"
              onMouseEnter={() => setMoreOpen(true)}
              onMouseLeave={() => setMoreOpen(false)}
            >
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="flex items-center gap-1.5 py-2 text-lg font-bold text-charcoal hover:text-forest"
              >
                <span aria-hidden="true">➕</span> More
                <span className={`inline-block text-sm transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full z-50 w-56 border-[1.5px] border-charcoal bg-background py-2 shadow-[0_14px_28px_-12px_rgb(30_30_30/0.4)]">
                  {MORE_NAV.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-5 py-2.5 text-base font-bold text-charcoal no-underline hover:bg-mintlight"
                    >
                      <NavIcon item={item} size="h-7 w-7" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/contact"
              className="text-lg font-bold text-charcoal no-underline hover:text-forest"
            >
              <span className="mr-1.5" aria-hidden="true">📞</span>Contact
            </Link>
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <a
            href={BUSINESS.phoneHref}
            className="hidden whitespace-nowrap font-bold text-forest no-underline hover:underline md:inline"
          >
            {BUSINESS.phone}
          </a>
          <Link
            to="/admin"
            className="hidden text-xs font-semibold uppercase tracking-widest text-charcoal/35 no-underline hover:text-charcoal md:inline"
          >
            Admin
          </Link>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center border-[1.5px] border-charcoal xl:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {open ? (
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" />
              ) : (
                <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="border-t-[1.5px] border-charcoal bg-creamlight px-4 py-4 xl:hidden"
          aria-label="Mobile"
        >
          <ul className="space-y-3">
            {MAIN_NAV.map((item) => (
              <li key={item.to + item.label}>
                <Link
                  to={item.to}
                  className={`flex items-center gap-3 py-1 text-lg font-semibold no-underline ${
                    item.urgent ? "text-[#B91C1C]" : "text-charcoal"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <NavIcon item={item} size="h-8 w-8" />
                  {item.label}
                  {item.sub && <span className={item.urgent ? "text-[#B91C1C]" : "text-charcoal"}> {item.sub}</span>}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/contact"
                className="block py-1 text-lg font-semibold text-charcoal no-underline"
                onClick={() => setOpen(false)}
              >
                <span className="mr-2" aria-hidden="true">📞</span>Contact
              </Link>
            </li>
            <li className="border-t border-charcoal/20 pt-3">
              <p className="pb-1 text-xs font-bold uppercase tracking-widest text-charcoal/60">More</p>
              <ul className="space-y-2 pl-2">
                {MORE_NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 py-1 text-base font-semibold text-charcoal no-underline"
                      onClick={() => setOpen(false)}
                    >
                      <NavIcon item={item} size="h-7 w-7" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <a
                href={BUSINESS.phoneHref}
                className="block py-1 text-lg font-bold text-forest no-underline"
              >
                Call {BUSINESS.phone}
              </a>
            </li>
            {/* Owner-only entry — tiny and low-contrast at the very bottom of
                the mobile menu so customers never notice it. */}
            <li className="pt-2 text-center">
              <Link
                to="/admin"
                className="text-xs font-semibold uppercase tracking-widest text-charcoal/25 no-underline"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            </li>
          </ul>
        </nav>
      )}
      <FairyLights />
      <SeasonBanner />
      <PromoTag />
    </header>
  );
}
