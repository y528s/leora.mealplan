/**
 * A tiny helper for loading things from the database.
 *
 * Every screen that loads data needs the same four things: the data, a loading
 * flag, an error, and a way to reload. Writing that out in every screen is
 * boring and easy to get wrong, so we write it once here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If the screen closes while we are still waiting for the database, we must
  // not try to update it afterwards — React warns about that, and it can hide
  // real bugs. This ref lets us check "am I still on screen?".
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const result = await fn();
      if (alive.current) setData(result);
    } catch (e: any) {
      if (alive.current) setError(e?.message ?? 'Something went wrong');
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
