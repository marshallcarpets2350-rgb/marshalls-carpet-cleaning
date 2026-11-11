import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How long will my carpets take to dry?",
    a: "Usually 4–8 hours, depending on the weather and airflow in the house. We'll tell you on the day if anything needs longer — and how to speed it up.",
  },
  {
    q: "Will steam cleaning void my carpet warranty?",
    a: "The opposite. Steam cleaning (hot water extraction) is the method most carpet makers actually recommend to keep your warranty valid. It's the dry-only methods that sometimes cause problems.",
  },
  {
    q: "Do you guarantee stains will come out?",
    a: "No honest cleaner does. Before we start, we'll show you which marks should come out and which are permanent — that's part of the quote, not a surprise afterwards.",
  },
  {
    q: "Can you get pet stains and smells out?",
    a: "In most cases, yes. Pet wee soaks through to the underlay, so we treat the source — not just the surface. Cleaning only the top is why smells come back a week later.",
  },
  {
    q: "How does the travel fee work?",
    a: "It's worked out by road distance: free in Armidale, then $1 per kilometre each way outside town (flat rates for Uralla, Guyra and Walcha). Put your address into the quote and the fee shows in your total before you book — it never changes on the day.",
  },
  {
    q: "Do you do commercial work?",
    a: "Yes — motels, offices, clubs and large floor areas. Jobs over 300m² get tailored per-m² rates. Call us on 0423 581 223 and we'll come walk the floor.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <h1 className="text-center font-display text-4xl font-black leading-tight text-charcoal md:text-5xl">
          Asked every week
        </h1>
        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-b-[1.5px] border-charcoal"
            >
              <AccordionTrigger className="py-5 text-left text-lg font-bold text-charcoal hover:text-forest hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-6 leading-relaxed text-charcoal/80">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
