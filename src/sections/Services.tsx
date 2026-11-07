import { Link } from "react-router";

const SERVICES = [
  {
    title: "Carpet cleaning",
    body: "Hot water extraction — the steam method carpet manufacturers recommend. The bigger the house, the cheaper the metre.",
    price: "instant online quote",
    to: "/quote?service=carpet",
  },
  {
    title: "Rug pick-up & clean",
    body: "Rugs collected Friday afternoon, washed and dried at our place, and back on your floor Monday. Free pickup in Armidale ($1/km outside) — five or more rugs takes 10% off.",
    price: "instant online quote",
    to: "/rugs",
  },
  {
    title: "Lounge & upholstery",
    body: "Couches, armchairs and recliners priced per seat with three soiling levels, so a lightly-used 2-seater never costs the same as the family dog's 5-seater.",
    price: "instant online quote",
    to: "/lounge?service=upholstery",
  },
  {
    title: "Mattress cleaning",
    body: "Single through king, each with its own soiling level. Sweat, dust mites and allergens lifted out — not just the surface freshened.",
    price: "instant online quote",
    to: "/lounge?service=mattress",
  },
  {
    title: "Stains, dirt & gum",
    body: "A dedicated treatment package for the jobs that need more than a standard clean — ground-in dirt, chewing gum, and heavy staining. Enzyme pre-spray for pet odour and urine.",
    price: "instant online quote",
    to: "/quote",
  },
  {
    title: "End of lease",
    body: "Carpets cleaned to the standard property managers inspect against, with a written quote you can forward to your agent before booking.",
    price: "instant written quote",
    to: "/quote?purpose=moving-out",
  },
  {
    title: "Commercial",
    body: "Motels, offices, clubs and large floor areas. 300m²+ jobs get tailored per-m² rates — call us directly and we'll walk the floor.",
    price: "call for rates",
    to: "/quote",
  },
];

export default function Services() {
  return (
    <section id="services" className="bg-creamlight py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h1 className="max-w-2xl font-display text-4xl font-black leading-tight text-charcoal md:text-5xl">
          Everything on the floor, and most things on it.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-charcoal/75">
          Carpet gets its own quote — rugs have their own pick-up run, and
          lounges and mattresses are priced per piece. Same day, same visit.
        </p>

        <div className="mt-12 grid gap-px border-[1.5px] border-charcoal bg-charcoal sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link
              key={s.title}
              to={s.to}
              className="group relative bg-background p-6 no-underline transition-colors duration-200 hover:bg-mintlight md:p-8"
            >
              <h3 className="font-display text-2xl font-black text-charcoal">
                → {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-charcoal/80">{s.body}</p>
              <p className="mt-5 inline-block border-[1.5px] border-charcoal bg-cream px-3 py-1 text-sm font-bold text-charcoal transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100">
                {s.price}
              </p>
              <p className="mt-2 text-sm font-bold text-forest">Start this quote →</p>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <Link to="/quote" className="btn-pill">
            Price these up →
          </Link>
        </div>
      </div>
    </section>
  );
}

