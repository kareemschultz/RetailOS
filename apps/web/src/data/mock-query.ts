import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

import { type FeatureKey, getFeatureStatus } from "./feature-status";

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

export type FeatureQueryOptions<T> = {
  /** Registry key; decides whether the real queryFn or the mock is used. */
  feature: FeatureKey;
  /** Stable query key segment. Prefixed with "mock" when serving mock data. */
  queryKey: readonly unknown[];
  /** Canned data (or factory) used when the feature is not fully "real". */
  mock: T | (() => T);
  /**
   * The real oRPC query function. Only invoked when the feature is "real".
   * Omit it for surfaces with no backend at all — the mock always serves.
   */
  real?: () => Promise<T>;
  latencyMs?: number;
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;
};

/**
 * useFeatureQuery — the single entry point every rebuilt surface uses to read
 * data. It consults the feature-status registry: a "real" feature (with a
 * `real` queryFn provided) hits the live oRPC endpoint; anything else serves
 * the typed mock behind a `["mock", ...]` key. Because the return type is a
 * plain `UseQueryResult<T>` either way, flipping a surface from mock → real is
 * a one-line change here (add the `real` fn + set the registry to "real") with
 * zero edits to the page. No conditional hooks: `useQuery` is always called,
 * only its key + queryFn switch.
 */
export function useFeatureQuery<T>({
  feature,
  queryKey,
  mock,
  real,
  latencyMs = MOCK_LATENCY_MS,
  options,
}: FeatureQueryOptions<T>): UseQueryResult<T> {
  const useReal = getFeatureStatus(feature).source === "real" && Boolean(real);
  return useQuery<T>({
    queryKey: useReal ? [...queryKey] : ["mock", ...queryKey],
    queryFn: useReal
      ? (real as () => Promise<T>)
      : () =>
          new Promise<T>((resolve) => {
            setTimeout(() => {
              resolve(typeof mock === "function" ? (mock as () => T)() : mock);
            }, latencyMs);
          }),
    staleTime: useReal ? undefined : Number.POSITIVE_INFINITY,
    ...options,
  });
}
