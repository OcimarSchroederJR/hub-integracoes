type Papel = 'bom' | 'info' | 'atencao' | 'critico' | 'neutro';

// Paleta de status fixa (bom/info/atenção/crítico) -- nunca reaproveitada
// para identidade de outra coisa. "info" cobre estados em andamento, que
// não são nem sucesso nem problema.
const PAPEL_POR_SITUACAO: Record<string, Papel> = {
  CONCLUIDA: 'bom',
  PERSISTIDO: 'bom',
  QUITADA: 'bom',
  PENDENTE: 'neutro',
  PROCESSANDO: 'info',
  EM_NEGOCIACAO: 'info',
  REJEITADO: 'atencao',
  CANCELADA: 'atencao',
  EM_ATRASO: 'critico',
  FALHA: 'critico',
};

export function StatusBadge({ situacao }: { situacao: string }) {
  const papel = PAPEL_POR_SITUACAO[situacao] ?? 'neutro';
  return <span className={`badge badge-${papel}`}>{situacao}</span>;
}
