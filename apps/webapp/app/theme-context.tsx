'use client';

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem('theme');

  return stored === 'light' || stored === 'dark' ? stored : null;
}

function getPreferredTheme(): Theme {
  const stored = getStoredTheme();

  if (stored) {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getHydratedServerSnapshot = () => false;

/**
 * `false` during the server render and the hydration pass, `true` afterwards.
 * It lets the provider render the stored/system preference only once the markup
 * is hydrated, so the toggle text cannot mismatch the server HTML.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );
}

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const [storedTheme, setStoredTheme] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'light' : getPreferredTheme(),
  );
  const theme: Theme = hydrated ? storedTheme : 'light';

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    setStoredTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);

      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeContextProvider');
  }
  return context;
}
