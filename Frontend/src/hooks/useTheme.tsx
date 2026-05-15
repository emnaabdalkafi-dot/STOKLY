import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface ThemeContextValue {
  darkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
  const root = document.documentElement;

  if (darkMode) {
    root.classList.add('dark-mode');
  } else {
    root.classList.remove('dark-mode');
  }

  localStorage.setItem('darkMode', String(darkMode));
}, [darkMode]);

  const value = useMemo(
    () => ({
      darkMode,
      toggleTheme: () => setDarkMode((prev) => !prev),
    }),
    [darkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
