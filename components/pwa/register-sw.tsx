'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker once the page has loaded. Silent on failure and
 * skips non-secure / unsupported contexts, so it never affects the app if the
 * worker can't install.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ignore — the app works fine without the worker */
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
