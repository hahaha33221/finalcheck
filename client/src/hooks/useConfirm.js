import { useCallback, useRef, useState } from 'react';

export function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(({ title, desc, ok, kind }) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ title, desc, ok, kind, resolve });
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  return { confirmState: state, confirm, closeConfirm: close };
}
