import { useEffect, useState } from 'react';

/** Runs a data-source call and tracks loading / error. Keyed so it re-runs when inputs change. */
export function useAsync<T>(fn: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: Error }>({ key });
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ key, data }),
      (error: Error) => alive && setState({ key, error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: !current || (!state.data && !state.error) };
}
