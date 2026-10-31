import { useState } from "react";
import { Link } from "react-router";
import Header from "@/sections/Header";
import Footer from "@/sections/Footer";
import { trpc } from "@/providers/trpc";

export default function Unsubscribe() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const unsub = trpc.public.unsubscribe.useMutation({
    onSuccess: () => setDone(true),
  });

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="bg-creamlight py-20">
        <div className="mx-auto max-w-md px-4">
          <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-8">
            {done ? (
              <>
                <h1 className="font-display text-3xl font-black text-charcoal">
                  You're off the list.
                </h1>
                <p className="mt-3 text-charcoal/75">
                  No more monthly emails. If you ever want back in, the signup box is at
                  the bottom of the homepage.
                </p>
                <Link to="/" className="btn-pill mt-6">Back to the site</Link>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  unsub.mutate({ email });
                }}
              >
                <h1 className="font-display text-3xl font-black text-charcoal">
                  Unsubscribe
                </h1>
                <p className="mt-3 text-charcoal/75">
                  Enter the email address you subscribed with and we'll take you off the
                  monthly deals list straight away.
                </p>
                <label htmlFor="unsub-email" className="mb-2 mt-6 block font-bold text-charcoal">
                  Email
                </label>
                <input
                  id="unsub-email"
                  type="email"
                  required
                  className="input-sharp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="btn-pill-dark mt-6 w-full" disabled={unsub.isPending}>
                  {unsub.isPending ? "Removing…" : "Unsubscribe me"}
                </button>
                {unsub.isError && (
                  <p className="mt-3 text-sm font-semibold text-destructive">
                    Something went wrong — try again.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
