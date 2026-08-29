import { LoggerJsonService } from './logger-json.service';
import { executarComCorrelationId } from './contexto-correlacao';

function capturarLinhaEscrita(fn: () => void): Record<string, unknown> {
  const escreverOriginal = process.stdout.write.bind(process.stdout);
  let capturado = '';
  process.stdout.write = ((chunk: string) => {
    capturado += chunk;
    return true;
  }) as typeof process.stdout.write;

  try {
    fn();
  } finally {
    process.stdout.write = escreverOriginal;
  }

  return JSON.parse(capturado.trim());
}

describe('LoggerJsonService', () => {
  it('emite uma linha JSON com timestamp, level, context e message', () => {
    const logger = new LoggerJsonService('MeuContexto');

    const linha = capturarLinhaEscrita(() => logger.log('processou 3 itens'));

    expect(linha.level).toBe('log');
    expect(linha.context).toBe('MeuContexto');
    expect(linha.message).toBe('processou 3 itens');
    expect(typeof linha.timestamp).toBe('string');
    expect(linha.correlationId).toBeUndefined();
  });

  it('não deixa código de cor ANSI escapar para o campo context', () => {
    const logger = new LoggerJsonService('OutroContexto');

    const linha = capturarLinhaEscrita(() => logger.warn('cuidado'));

    expect(linha.context).toBe('OutroContexto');
    expect(String(linha.context)).not.toMatch(/\x1B/);
  });

  it('inclui o correlationId do contexto ativo', () => {
    const logger = new LoggerJsonService('ComCorrelacao');

    let linha: Record<string, unknown> = {};
    executarComCorrelationId('exec-999', () => {
      linha = capturarLinhaEscrita(() => logger.log('dentro do contexto'));
    });

    expect(linha.correlationId).toBe('exec-999');
  });
});
