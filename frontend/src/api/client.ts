import axios from 'axios';

export const TOKEN_KEY = 'hub_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export function mensagemDeErro(erro: unknown): string {
  if (axios.isAxiosError(erro)) {
    const dado = erro.response?.data as { message?: string | string[] } | undefined;
    if (dado?.message) {
      return Array.isArray(dado.message) ? dado.message.join('; ') : dado.message;
    }
    return erro.message;
  }
  return String(erro);
}
