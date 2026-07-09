import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

/**
 * mock-query — the bridge that lets UI for missing/buggy backend surfaces use
 * the EXACT same hook shape as a real oRPC query. Every feature hook returns a
 * TanStack `UseQueryResult`, whether the data is real or mocked, so swapping a
 * mock for a real endpoint later is a one-line change inside the hook — no page
 * edits. Mock queries are namespaced under a `["mock", ...]` query key so they
 * are trivially discoverable in devtools and never collide with real caches.
 */

const MOCK_LATENCY_MS = 350;

export type MockQueryOptions<T> = {
  /** Stable key segment, e.g. ["customers","list"]. Prefixed with "mock". */
  key: readonly unknown[];
  /** The canned data (or a factory) this surface should render. */
  data: T | (() => T);
  /** Simulated network latency in ms. Defaults to 350ms. */
  latencyMs?: number;
  /** Pass-through TanStack options (enabled, staleTime, select, ...). */
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;
};

/**
 * Returns a real TanStack query backed by in-memory mock data with a small
 * simulated latency so loading skeletons and empty/error states are exercised
 * exactly as they will be against the live API.
 */
export function useMockQuery<T>({
  key,
  data,
  latencyMs = MOCK_LATENCY_MS,
  options,
}: MockQueryOptions<T>): UseQueryResult<T> {
  return useQuery<T>({
    queryKey: ["mock", ...key],
    queryFn: () =>
      new Promise<T>((resolve) => {
        setTimeout(() => {
          resolve(typeof data === "function" ? (data as () => T)() : data);
        }, latencyMs);
      }),
    // Mock data is deterministic; keep it fresh-forever so we don't thrash.
    staleTime: Number.POSITIVE_INFINITY,
    ...options,
  });
}
