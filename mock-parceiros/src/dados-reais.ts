import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Valores monetários reais (não os nomes/CPFs, que continuam sintéticos),
 * amostrados do dataset público "Default of Credit Card Clients" (UCI
 * Machine Learning Repository, Yeh & Lien, 2009 -- 30000 clientes de
 * cartão de crédito em Taiwan, anonimizado). Usado aqui só pela
 * distribuição de valores de fatura, não por qualquer relação com o
 * domínio de cobrança em si.
 */
export interface RegistroCreditoReal {
  valorFaturaCentavos: number;
  valorPagoCentavos: number;
  inadimplente: boolean;
}

function carregarCsv(): RegistroCreditoReal[] {
  const caminho = join(__dirname, '..', 'data', 'creditos-reais.csv');
  const conteudo = readFileSync(caminho, 'utf-8');
  const linhas = conteudo.trim().split('\n').slice(1);

  return linhas.map((linha) => {
    const [valorFatura, valorPago, inadimplente] = linha.split(',');
    return {
      valorFaturaCentavos: Number(valorFatura),
      valorPagoCentavos: Number(valorPago),
      inadimplente: inadimplente === '1',
    };
  });
}

const registros = carregarCsv();

export function obterCreditoReal(indice: number): RegistroCreditoReal {
  return registros[indice % registros.length];
}

export type SituacaoCredito = 'ATRASO' | 'NEGOCIACAO' | 'QUITADO' | 'CANCELADO';

/**
 * Deriva uma situação a partir de "inadimplente" (a coluna real "default
 * payment next month") e da proporção paga -- não existe uma coluna
 * pronta de "situação de cobrança" no dataset original, porque ele foi
 * feito pra prever inadimplência, não pra representar uma carteira em
 * cobrança. Critério: quem vai inadimplir no próximo mês está em
 * atraso; entre quem não vai, quem já pagou tudo está quitado, quem não
 * pagou nada está cancelado, e quem pagou uma parte está em negociação.
 */
export function obterSituacaoDoCredito(indice: number): SituacaoCredito {
  const registro = obterCreditoReal(indice);
  if (registro.inadimplente) {
    return 'ATRASO';
  }
  if (registro.valorPagoCentavos <= 0) {
    return 'CANCELADO';
  }
  if (registro.valorPagoCentavos >= registro.valorFaturaCentavos) {
    return 'QUITADO';
  }
  return 'NEGOCIACAO';
}
