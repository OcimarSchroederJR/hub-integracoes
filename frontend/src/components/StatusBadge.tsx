const CORES: Record<string, string> = {
  CONCLUIDA: 'verde',
  PERSISTIDO: 'verde',
  QUITADA: 'verde',
  PENDENTE: 'cinza',
  PROCESSANDO: 'azul',
  EM_NEGOCIACAO: 'azul',
  REJEITADO: 'amarelo',
  CANCELADA: 'amarelo',
  EM_ATRASO: 'vermelho',
  FALHA: 'vermelho',
};

export function StatusBadge({ situacao }: { situacao: string }) {
  const cor = CORES[situacao] ?? 'cinza';
  return <span className={`badge badge-${cor}`}>{situacao}</span>;
}
