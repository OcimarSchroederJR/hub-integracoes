import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, TOKEN_KEY } from '../api/client';

interface AuthContextValue {
  autenticado: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  async function login(email: string, senha: string): Promise<void> {
    const resposta = await api.post<{ accessToken: string }>('/auth/login', { email, senha });
    localStorage.setItem(TOKEN_KEY, resposta.data.accessToken);
    setAutenticado(true);
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    setAutenticado(false);
  }

  return <AuthContext.Provider value={{ autenticado, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa estar dentro de um AuthProvider');
  }
  return contexto;
}
