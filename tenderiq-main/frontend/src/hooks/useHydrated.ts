import { useEffect, useState } from 'react';

/**
 * Returns `false` on the server and during the very first client render,
 * then flips to `true` after mount. Use this to gate client-only UI so
 * the first client paint matches the server render — no React hydration
 * mismatch warnings.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

export default useHydrated;
