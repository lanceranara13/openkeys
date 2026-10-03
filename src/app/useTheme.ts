import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// index.html reads the same key before the first paint, so the page never flashes
// the wrong theme. Keep the two in sync.
const STORAGE_KEY = 'openkeys:theme';
const CANVAS = { light: '#f1efe7', dark: '#181916' };

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const systemTheme = (): Theme => (systemQuery().matches ? 'dark' : 'light');

function chosenTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Storage is blocked: behave as if nothing was chosen.
    return null;
  }
}

/** The colour theme. Follows the system until the user picks one. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => chosenTheme() ?? systemTheme());

  useEffect(() => {
    const query = systemQuery();
    const follow = () => {
      if (!chosenTheme()) setTheme(systemTheme());
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme]);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies until the page is closed.
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
