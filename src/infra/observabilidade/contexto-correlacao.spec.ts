import { executarComCorrelationId, obterCorrelationId } from './contexto-correlacao';

describe('contexto de correlação', () => {
  it('não tem correlationId fora de um contexto', () => {
    expect(obterCorrelationId()).toBeUndefined();
  });

  it('expõe o correlationId dentro do contexto, mesmo atravessando await', async () => {
    await executarComCorrelationId('abc-123', async () => {
      expect(obterCorrelationId()).toBe('abc-123');
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(obterCorrelationId()).toBe('abc-123');
    });
  });

  it('não vaza correlationId de volta para fora do contexto', async () => {
    await executarComCorrelationId('abc-123', async () => {
      expect(obterCorrelationId()).toBe('abc-123');
    });
    expect(obterCorrelationId()).toBeUndefined();
  });

  it('mantém contextos concorrentes isolados um do outro', async () => {
    const resultados: string[] = [];

    await Promise.all([
      executarComCorrelationId('execucao-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resultados.push(`1:${obterCorrelationId()}`);
      }),
      executarComCorrelationId('execucao-2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        resultados.push(`2:${obterCorrelationId()}`);
      }),
    ]);

    expect(resultados.sort()).toEqual(['1:execucao-1', '2:execucao-2']);
  });
});
