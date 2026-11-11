import { useState } from "react";
import { trpc } from "@/providers/trpc";

export default function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState<null | "new" | "already" | "resubscribed">(null);
  const subscribe = trpc.public.subscribe.useMutation({
    onSuccess: (r) => setDone(r.resubscribed ? "resubscribed" : r.already ? "already" : "new"),
    onError: () => setDone(null),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    subscribe.mutate({ email, name: name || undefined, source });
  };

  if (done) {
    return (
      <div className="border-[1.5px] border-charcoal bg-mintlight p-6">
        <p className="font-display text-2xl font-black text-forest">
          {done === "already" ? "You're already on the list." : "You're in."}
        </p>
        <p className="mt-2 text-charcoal/80">
          {done === "already"
            ? "Keep an eye on your inbox — the next monthly deals email is coming."
            : "You're on the list — deals and cleaning reminders land in your inbox from here."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="sr-only" htmlFor={`nl-name-${source}`}>Name</label>
      <input
        id={`nl-name-${source}`}
        className="input-sharp"
        placeholder="First name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="given-name"
      />
      <label className="sr-only" htmlFor={`nl-email-${source}`}>Email</label>
      <input
        id={`nl-email-${source}`}
        className="input-sharp"
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <button type="submit" className="btn-pill-dark whitespace-nowrap" disabled={subscribe.isPending}>
        {subscribe.isPending ? "Joining…" : "Get the deals"}
      </button>
      {subscribe.isError && (
        <p className="text-sm font-semibold text-destructive sm:col-span-3">
          Something went wrong — please try again.
        </p>
      )}
    </form>
  );
}
