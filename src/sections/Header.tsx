import { useState } from "react";
import { Link } from "react-router";
import { BUSINESS } from "@contracts/rates";
import logo from "@/assets/logo.png";
import iconCarpet from "@/assets/icons/carpet-cleaning.png";
import iconLounge from "@/assets/icons/lounge.png";
import iconRug from "@/assets/icons/rug-pickup.png";
import iconPrices from "@/assets/icons/prices.png";
import iconCompare from "@/assets/icons/compare.png";
import iconAreas from "@/assets/icons/areas.png";

type NavItem = { icon?: string; emoji?: string; label: string; sub?: string; to: string };

const MAIN_NAV: NavItem[] = [
  { icon: iconCarpet, label: "Carpet cleaning", sub: "quote", to: "/quote" },
  { icon: iconRug, label: "Rug pick-up", sub: "& clean", to: "/rugs" },
  { icon: iconLounge, label: "Lounge & mattress", sub: "& upholstery", to: "/lounge" },
];

const MORE_NAV: NavItem[] = [
  { icon: iconPrices, label: "Prices", to: "/prices" },
  { icon: iconCompare, label: "Compare us", to: "/compare" },
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
  return <span aria-hidden="true">{item.emoji}</span>;
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-charcoal bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2 pl-1 pr-4 md:pl-2 md:pr-6">
        <Link to="/" className="shrink-0 no-underline" aria-label="Marshall's Carpet Cleaning — home">
          <img
            src={logo}
            alt="Marshall's Carpet Cleaning"
            className="h-20 w-auto md:h-28"
          />
        </Link>

        <nav className="hidden flex-1 items-center justify-evenly xl:flex" aria-label="Main">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.to + item.label}
              to={item.to}
              className="whitespace-nowrap text-center text-lg font-bold leading-tight text-charcoal no-underline hover:text-forest"
            >
              <span className="mb-1 block">
                <NavIcon item={item} size="h-9 w-9" />
              </span>
              {item.label}
              {item.sub && (
                <span className="block text-sm font-bold text-charcoal">{item.sub}</span>
              )}
            </Link>
          ))}

          {/* Everything else lives under More */}
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
              <div className="absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 border-[1.5px] border-charcoal bg-background py-2 shadow-[0_14px_28px_-12px_rgb(30_30_30/0.4)]">
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
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <a
            href={BUSINESS.phoneHref}
            className="hidden whitespace-nowrap font-bold text-forest no-underline hover:underline md:inline"
          >
            {BUSINESS.phone}
          </a>
          <Link
            to="/quote"
            className="whitespace-nowrap rounded-xl bg-mint px-8 py-3 text-center text-sm font-bold text-background no-underline transition-colors hover:bg-forest md:px-12 md:py-3.5 md:text-lg"
          >
            Get my quote
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
                  className="flex items-center gap-3 py-1 text-lg font-semibold text-charcoal no-underline"
                  onClick={() => setOpen(false)}
                >
                  <NavIcon item={item} size="h-8 w-8" />
                  {item.label}
                  {item.sub && <span className="text-charcoal"> {item.sub}</span>}
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
          </ul>
        </nav>
      )}
    </header>
  );
}
