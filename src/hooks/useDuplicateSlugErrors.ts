import { useEffect, useRef, useState } from 'react';

export type SlugCheck = { key: string; run: () => Promise<boolean> };

/**
 * Debounces a set of async duplicate-slug checks and returns a map of error
 * messages keyed by `check.key`. A `null` value means no error.
 *
 * `build` is called on each dependency change to produce the current set of
 * checks. Keep it cheap; the actual network calls happen inside `run`.
 */
export function useDuplicateSlugErrors(
  build: () => SlugCheck[],
  deps: ReadonlyArray<unknown>,
  options: { debounceMs?: number; message?: string } = {},
): Record<string, string | null> {
  const { debounceMs = 400, message = 'Aquest slug ja existeix en aquest idioma' } = options;
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const timer = useRef<number | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const checks = build();
    if (checks.length === 0) {
      setErrors({});
      return;
    }
    timer.current = window.setTimeout(async () => {
      const myRun = ++runIdRef.current;
      const entries = await Promise.all(
        checks.map(async (c) => {
          try {
            const dup = await c.run();
            return [c.key, dup ? message : null] as const;
          } catch {
            return [c.key, null] as const;
          }
        }),
      );
      // Avoid clobbering state if a newer run started meanwhile.
      if (myRun !== runIdRef.current) return;
      const next: Record<string, string | null> = {};
      for (const [k, v] of entries) next[k] = v;
      setErrors(next);
    }, debounceMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return errors;
}

export function hasAnySlugError(map: Record<string, string | null>): boolean {
  return Object.values(map).some((v) => !!v);
}
