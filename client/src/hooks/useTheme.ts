import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

// Dark is the default. A saved "light" preference is still honoured.
function getInitialTheme(): Theme {
  try {
    return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch {
      // Storage unavailable (private mode); the choice lasts for this session.
    }
  };

  return { theme, toggleTheme };
}
