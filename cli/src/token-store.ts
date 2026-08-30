import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DIRETORIO = join(homedir(), '.hub-cli');
const ARQUIVO_TOKEN = join(DIRETORIO, 'token');

export function salvarToken(token: string): void {
  mkdirSync(DIRETORIO, { recursive: true });
  writeFileSync(ARQUIVO_TOKEN, token, { mode: 0o600 });
}

export function lerToken(): string | undefined {
  if (!existsSync(ARQUIVO_TOKEN)) {
    return undefined;
  }
  return readFileSync(ARQUIVO_TOKEN, 'utf-8').trim() || undefined;
}

export function apagarToken(): void {
  if (existsSync(ARQUIVO_TOKEN)) {
    rmSync(ARQUIVO_TOKEN);
  }
}
