import { useEffect, useState } from 'react';

/** Non-maximized desktop windows. The welcome card has to fit inside these. */
export const SHORT_WINDOW_MAX_HEIGHT = 860;

export function useShortWindow(maxHeight = SHORT_WINDOW_MAX_HEIGHT): boolean {
  const [short, setShort] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight <= maxHeight : false,
  );
  useEffect(() => {
    const update = () => setShort(window.innerHeight <= maxHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [maxHeight]);
  return short;
}
