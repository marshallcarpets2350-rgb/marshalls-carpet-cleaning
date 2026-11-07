/**
 * Terms & Conditions — single source of truth.
 *
 * Used in three places so they never drift apart:
 *   1. The /terms page on the website (src/pages/Terms.tsx)
 *   2. The PDF attached to every booking confirmation (api/termsPdf.ts)
 *   3. The plain-text version inside the confirmation email body
 *
 * Plain English on purpose — customers should actually be able to read it.
 * Standing rule: never print the owner's personal name — "Marshall's" only.
 */

import { BUSINESS } from "./rates";

export const TERMS_LAST_UPDATED = "November 2026";

export interface TermsSection {
  title: string;
  /** Paragraphs and bullets render in order. */
  body: (string | { bullets: string[] })[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: "1. Definitions",
    body: [
      '"Client" means the person or entity booking and/or receiving the Services.',
      '"Services" means carpet cleaning, upholstery and lounge cleaning, mattress cleaning, rug pick-up and cleaning, stain treatment, and any additional services as quoted.',
      '"Premises" means the location where Services are to be performed.',
      '"Quote" means the price provided to the Client prior to service commencement, whether through the website, in writing, or verbally.',
      '"Stain" means any discolouration, mark, or spot on carpet, upholstery, rug, or mattress fibres.',
    ],
  },
  {
    title: "2. Quotes and acceptance",
    body: [
      "2.1 All Quotes are valid for 30 days from the date of issue unless otherwise specified.",
      "2.2 Website quotes are calculated from the details you enter — room sizes, condition, stains and access. The final price may vary from the Quote if:",
      {
        bullets: [
          "(a) the actual area to be cleaned differs from the quoted area;",
          "(b) additional services are requested on-site;",
          "(c) the condition of the carpet, upholstery, rug or mattress requires treatment beyond what was described at booking.",
        ],
      },
      "2.3 If anything needs to change, we'll always tell you the revised price and get your OK before we start — no surprises on the day.",
      "2.4 Acceptance of the Quote — by booking online, replying to a quote email, or asking us to proceed — constitutes agreement to these Terms and Conditions.",
      "2.5 A minimum charge applies to every job, as shown on the website at the time of booking.",
    ],
  },
  {
    title: "3. Scope of services",
    body: [
      "3.1 Standard carpet cleaning includes pre-vacuuming (if required), pre-treatment of stains and high-traffic areas, and hot water extraction (steam cleaning). Deeper clean levels (Deep clean and Restoration clean) add heavier pre-treatment, agitation and extra passes as described on the website.",
      "3.2 Upholstery and lounge cleaning is priced per seat and includes pre-treatment and hot water extraction suited to the fabric. Recliner and mechanism seats carry an additional charge as quoted.",
      "3.3 Mattress cleaning includes vacuuming, treatment and hot water extraction of the mattress top and sides.",
      "3.4 Rug pick-up and cleaning: rugs are collected from your Premises, cleaned off-site, and returned to you. We'll confirm the return day when we collect. Care is taken in transit, and rugs are wrapped for the trip home.",
      "3.5 Stain treatment is priced for the toughest stain type identified, with each additional type at a reduced rate, as shown in your Quote. Stain treatment is included at no extra charge on a Restoration clean.",
    ],
  },
  {
    title: "4. Pricing, travel and discounts",
    body: [
      "4.1 All prices are in Australian dollars and are shown before you book — the price you accept is the price on your confirmation.",
      "4.2 Travel is free within Armidale. Beyond that, a per-kilometre or flat town travel fee applies and is included in your Quote before you book — never added later.",
      "4.3 Website volume discounts apply automatically to larger jobs, and maintenance-plan discounts apply to clients on a regular cleaning plan, as described on the website.",
      "4.4 Quotes already sent or bookings already confirmed keep the price they were accepted at, even if website prices change later.",
    ],
  },
  {
    title: "5. Payment",
    body: [
      "5.1 Payment options are chosen at booking:",
      {
        bullets: [
          "Pay now by card — a secure online payment for the full amount at the time of booking;",
          "Pay on the day — card, bank transfer or cash on completion of the job;",
          "Invoice after the job — payment due within 5 days of the job date.",
        ],
      },
      "5.2 Card payments are processed securely by our payment provider; we never see or store your card details.",
      "5.3 Overdue invoices may be re-issued with a reminder, and continued non-payment may be referred to a collection agency, with any reasonable collection costs added to the amount owing.",
    ],
  },
  {
    title: "6. Bookings, confirmations and cancellations",
    body: [
      "6.1 Every booking receives a confirmation by email or text message, including the date, arrival window, price breakdown and a copy of these Terms and Conditions.",
      "6.2 We'll call or text the day before your job to confirm the exact arrival time.",
      "6.3 Life happens — you can reschedule free of charge up to 24 hours before your booking by calling or texting us.",
      "6.4 Cancellations within 24 hours of the booking, or where we arrive and can't access the Premises, may incur a call-out fee up to the value of the minimum charge.",
      "6.5 We may need to reschedule in rare circumstances (breakdown, severe weather, illness). If that happens we'll contact you as early as possible and offer the next available slot that suits you.",
    ],
  },
  {
    title: "7. Access, preparation and on-site requirements",
    body: [
      "7.1 The Client will provide access to the Premises at the agreed time, along with electricity and hot water for our equipment.",
      "7.2 Please have the areas to be cleaned reasonably clear of small items, breakables and clutter. We'll move light furniture as needed; heavy items (wall units, pianos, pool tables, large entertainment units) are cleaned around unless moving them was arranged beforehand.",
      "7.3 Please secure pets and let us know about anything that needs special care — loose carpet edges, previous damage, or delicate fibres.",
      "7.4 Safe parking close to the Premises helps us run hoses and equipment; if parking is tricky, let us know at booking.",
    ],
  },
  {
    title: "8. Stains, wear and results — the honest bit",
    body: [
      "8.1 We treat every stain with professional products and techniques, but we can't guarantee complete removal of every stain — some stains may be permanent. Some things permanently alter carpet fibres — bleach, some dyes, pet urine that has reached the underlay, and worn traffic areas can look different even after a thorough clean. Where a stain is permanent, we'll still treat it to lighten it as much as the fibres allow.",
      "8.2 Where we think a stain or area may not come out completely, we'll tell you honestly before we start.",
      "8.3 Drying typically takes 4 to 24 hours depending on weather, airflow and clean level. We'll leave you with simple drying tips on the day.",
    ],
  },
  {
    title: "9. Our 7-day put-it-right promise",
    body: [
      "9.1 If anything at all doesn't look right after your clean, call us within 7 days and we'll come back and put it right — free. That's the deal.",
      "9.2 The promise covers the areas we cleaned. New stains or soiling after the clean aren't covered, but we're always happy to quote on them.",
    ],
  },
  {
    title: "10. Damage and liability",
    body: [
      "10.1 We carry public liability insurance and treat your home with care.",
      "10.2 Please tell us before we start about pre-existing damage, loose fittings, or items of particular value or fragility in the work area.",
      "10.3 Some fibres carry inherent risks (shrinkage, colour bleed or texture change in certain natural fibres and older carpets). We test where appropriate, but the Client accepts these inherent risks where materials are not suited to hot water extraction — we'll flag this before starting if we see it.",
      "10.4 Carpet that was loosely fitted at installation (not fully power-stretched) can show ripples or buckling while it's damp after a hot water extraction clean. This is a pre-existing installation condition that cleaning makes visible — not damage caused by cleaning — and in most cases the carpet settles flat again as it fully dries. Where ripples remain once the carpet is completely dry, re-stretching by a carpet layer may be needed and is the Client's responsibility to arrange; we're always happy to point you to someone.",
      "10.5 To the extent permitted by law, our liability for any claim is limited to the cost of the Services supplied, or re-supply of the Services. Nothing in these Terms excludes your rights under the Australian Consumer Law.",
    ],
  },
  {
    title: "11. Your details",
    body: [
      "11.1 We collect your name, contact details, address and job details so we can book, confirm, complete and follow up your job. We don't sell or share your details with anyone else, apart from the services that deliver your messages (email/SMS providers) and process your payment.",
      "11.2 You can ask us to update or delete your details at any time by calling or emailing us.",
    ],
  },
  {
    title: "12. General",
    body: [
      "12.1 These Terms are governed by the laws of New South Wales, Australia.",
      "12.2 We may update these Terms from time to time. The version on the website at the time of your booking applies to that booking, and the copy attached to your booking confirmation is yours to keep.",
      `12.3 Questions about anything here? Call ${BUSINESS.phone} or email ${BUSINESS.email} — you'll talk to the person who'll be doing the clean.`,
    ],
  },
];

/** Header block shown at the top of the page and the PDF. */
export const TERMS_HEADER = {
  title: "Terms & Conditions of Service",
  business: `${BUSINESS.legalName} — Armidale NSW`,
  abn: BUSINESS.abn,
  phone: BUSINESS.phone,
  email: BUSINESS.email,
  updated: TERMS_LAST_UPDATED,
};

/** Plain-text rendering for email bodies. */
export function termsAsPlainText(): string {
  const lines: string[] = [
    TERMS_HEADER.title.toUpperCase(),
    TERMS_HEADER.business,
    TERMS_HEADER.abn,
    `Phone: ${TERMS_HEADER.phone}`,
    `Email: ${TERMS_HEADER.email}`,
    `Last updated: ${TERMS_HEADER.updated}`,
    "",
  ];
  for (const s of TERMS_SECTIONS) {
    lines.push(s.title.toUpperCase(), "");
    for (const part of s.body) {
      if (typeof part === "string") lines.push(part, "");
      else for (const b of part.bullets) lines.push(`  • ${b}`);
      if (typeof part !== "string") lines.push("");
    }
  }
  return lines.join("\n");
}
