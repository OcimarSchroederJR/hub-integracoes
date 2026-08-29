import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { obterCorrelationId } from './contexto-correlacao';

// eslint-disable-next-line no-control-regex
const CODIGOS_ANSI = /\x1B\[[0-9;]*m/g;

function contextoLimpo(contextMessage: string): string {
  const semCores = contextMessage.replace(CODIGOS_ANSI, '').trim();
  const casamento = /^\[(.*)\]$/.exec(semCores);
  return casamento ? casamento[1] : semCores;
}

/**
 * Substitui a formatação padrão do Nest por uma linha JSON por
 * mensagem, com o correlationId do contexto ativo (RNF06) quando
 * houver um. Sem contexto ativo (log de bootstrap, por exemplo), a
 * linha sai igual, só sem o campo.
 */
export class LoggerJsonService extends ConsoleLogger {
  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    void pidMessage;
    void formattedLogLevel;
    void timestampDiff;

    const correlationId = obterCorrelationId();
    const linha = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      context: contextoLimpo(contextMessage),
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...(correlationId ? { correlationId } : {}),
    };
    return JSON.stringify(linha) + '\n';
  }
}
