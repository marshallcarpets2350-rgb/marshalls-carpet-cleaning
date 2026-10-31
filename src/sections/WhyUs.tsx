const POINTS = [
  {
    n: "01",
    title: "The price is the price",
    body: "Your quote is calculated from your rooms and your address — agreed before we start. Nothing gets added on the day unless you add it.",
  },
  {
    n: "02",
    title: "Hot water extraction",
    body: "Proper steam cleaning — the method major carpet manufacturers recommend, and the one that keeps many carpet warranties intact. High heat dissolves the greasy film that holds grit in the pile.",
  },
  {
    n: "03",
    title: "Local and answerable",
    body: "Marshall's lives and works here. When you call, you talk to the person who'll be doing the clean — and the same person stands behind the result.",
  },
  {
    n: "04",
    title: "Family-safe products",
    body: "Solutions that are safe for kids and pets — and straight talk before we start: we'll tell you honestly what will come out and what won't.",
  },
];

export default function WhyUs() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="font-display text-4xl font-black leading-tight text-charcoal md:text-5xl">
              Why Armidale calls{" "}
              <span className="relative inline-block">
                <span aria-hidden="true" className="absolute inset-x-0 bottom-1 -z-10 h-4 bg-cream md:h-6" />
                Marshall's
              </span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-charcoal/75">
              Anyone can rent a machine. What's harder to rent is a straight answer —
              on price, on stains, and on whether a job is worth doing at all.
            </p>
          </div>

          <div className="lg:col-span-3">
            <ol className="divide-y-[1.5px] divide-charcoal border-y-[1.5px] border-charcoal">
              {POINTS.map((p) => (
                <li key={p.n} className="grid gap-2 py-7 sm:grid-cols-[4rem_1fr] md:gap-6">
                  <span className="font-display text-3xl font-black text-mint">{p.n}</span>
                  <div>
                    <h3 className="text-xl font-bold text-charcoal">{p.title}</h3>
                    <p className="mt-2 leading-relaxed text-charcoal/80">{p.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
