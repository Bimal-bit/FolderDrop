import { useState, useEffect, useRef } from 'react';

/**
 * Counts down from `seconds` to 0.
 * Returns the remaining seconds and whether it has expired.
 */
export function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(seconds);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds, active]);

  const expired = remaining === 0;
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = expired
    ? 'Expired'
    : `${minutes}:${String(secs).padStart(2, '0')}`;

  return { remaining, expired, label };
}
