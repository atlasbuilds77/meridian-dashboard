import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [30, 100, 30, 100, 30],
};

export function useHaptics() {
  const vibrate = useCallback((pattern: HapticPattern = 'light') => {
    // Check if vibration API is supported
    if (!navigator.vibrate) {
      return;
    }

    // Get the vibration pattern
    const vibrationPattern = patterns[pattern];

    // Trigger vibration
    navigator.vibrate(vibrationPattern);
  }, []);

  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return {
    vibrate,
    isSupported,
  };
}
