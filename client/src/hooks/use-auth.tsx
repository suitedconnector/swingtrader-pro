import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

const AuthContext = createContext<{ user: any; isLoading: boolean } | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const res = await fetch('/api/user', {
        credentials: 'include',
      });

      if (res.status === 401) return null;
      if (!res.ok) throw new Error('Unable to check authentication');

      return await res.json();
    },
  });

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
