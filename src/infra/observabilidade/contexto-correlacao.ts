import { AsyncLocalStorage } from 'async_hooks';

interface ContextoCorrelacao {
  correlationId: string;
}

const armazenamento = new AsyncLocalStorage<ContextoCorrelacao>();

export function executarComCorrelationId<T>(correlationId: string, fn: () => T): T {
  return armazenamento.run({ correlationId }, fn);
}

export function obterCorrelationId(): string | undefined {
  return armazenamento.getStore()?.correlationId;
}
