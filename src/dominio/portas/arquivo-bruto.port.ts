export interface ArquivoBruto {
  arquivar(chave: string, conteudo: Buffer): Promise<void>;
}

export const ARQUIVO_BRUTO = 'ARQUIVO_BRUTO';

export function chaveArquivoBruto(
  parceiroCodigo: string,
  execucaoId: string,
  sequencial: number,
  extensao: string,
): string {
  return `raw/${parceiroCodigo}/${execucaoId}/${sequencial}.${extensao}`;
}
