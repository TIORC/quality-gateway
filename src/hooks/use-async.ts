import { useEffect, useState, RefObject } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/** useAsync simplificado para chamadas Supabase que resolvem uma promise. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let ativo = true;
    setState({ data: null, loading: true, error: null });
    Promise.resolve()
      .then(fn)
      .then((dados) => {
        if (ativo) setState({ data: dados, loading: false, error: null });
      })
      .catch((err) => {
        if (ativo) setState({ data: null, loading: false, error: err as Error });
      });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export default useAsync;
