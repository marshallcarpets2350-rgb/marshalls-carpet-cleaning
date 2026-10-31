import { trpc } from "@/providers/trpc";
import { DEFAULT_RATES, type Rates } from "@contracts/rates";

/** The live rate card — the owner's Admin → Settings prices when the server
 *  is reachable, the built-in figures otherwise (static demo file, offline,
 *  or still loading). Quote pages re-price automatically when it arrives. */
export function useRates(): Rates {
  const q = trpc.public.rates.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return q.data ?? DEFAULT_RATES;
}
