import express from 'express';
import { gerarCarteira } from './dados';
import { gerarCarteiraBetaCsv } from './dados-beta';

const app = express();
app.use(express.json());

const PORTA = Number(process.env.PORT) || 4000;
const TAMANHO_CARTEIRA = Number(process.env.ALFA_TAMANHO_CARTEIRA) || 500;
const TAMANHO_CARTEIRA_BETA = Number(process.env.BETA_TAMANHO_CARTEIRA) || 200;

/**
 * Ajustável em tempo real via POST /_controle/alfa, sem precisar
 * derrubar o container -- útil pra ligar o caos no meio de uma
 * demonstração e ver o efeito no painel na hora, em vez de precisar
 * reiniciar com outra variável de ambiente.
 */
const config = {
  simularFalhas: process.env.ALFA_SIMULAR_FALHAS !== 'false',
  limitePorMinuto: Number(process.env.ALFA_RATE_LIMIT_POR_MINUTO) || 60,
  probabilidadeFalha500: Number(process.env.ALFA_PROBABILIDADE_FALHA_500) || 0.05,
  latenciaMinMs: 100,
  latenciaMaxMs: 3_000,
};

const carteira = gerarCarteira(TAMANHO_CARTEIRA, config.simularFalhas);
const carteiraBetaCsv = gerarCarteiraBetaCsv(TAMANHO_CARTEIRA_BETA, config.simularFalhas);

function codificarCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf-8').toString('base64');
}

function decodificarCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const { offset } = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    return typeof offset === 'number' ? offset : 0;
  } catch {
    return 0;
  }
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let inicioJanela = Date.now();
let chamadasNaJanela = 0;

function excedeuLimiteDeRequisicoes(): boolean {
  const agora = Date.now();
  if (agora - inicioJanela >= 60_000) {
    inicioJanela = agora;
    chamadasNaJanela = 0;
  }
  chamadasNaJanela += 1;
  return chamadasNaJanela > config.limitePorMinuto;
}

app.get('/v1/portfolio', async (req, res) => {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'token ausente' });
    return;
  }

  if (excedeuLimiteDeRequisicoes()) {
    res.status(429).json({ error: `limite de ${config.limitePorMinuto} requisições por minuto excedido` });
    return;
  }

  if (config.simularFalhas) {
    await aguardar(config.latenciaMinMs + Math.random() * (config.latenciaMaxMs - config.latenciaMinMs));

    if (Math.random() < config.probabilidadeFalha500) {
      res.status(500).json({ error: 'falha interna simulada' });
      return;
    }
  }

  const limite = Math.min(Number(req.query.limit) || 100, 100);
  const offset = decodificarCursor(req.query.cursor as string | undefined);
  const pagina = carteira.slice(offset, offset + limite);
  const proximoOffset = offset + limite;
  const hasMore = proximoOffset < carteira.length;

  res.json({
    data: pagina,
    nextCursor: hasMore ? codificarCursor(proximoOffset) : null,
    hasMore,
  });
});

app.post('/v1/portfolio/:externalId/status', (req, res) => {
  console.log(`[mock-alfa] status recebido para ${req.params.externalId}:`, req.body);
  res.status(202).send();
});

app.get('/beta/carteira.csv', (_req, res) => {
  res.set('Content-Type', 'text/csv; charset=iso-8859-1');
  res.send(Buffer.from(carteiraBetaCsv, 'latin1'));
});

app.post('/beta/webhook', (req, res) => {
  console.log('[mock-beta] evento recebido no webhook:', req.body);
  res.status(200).send();
});

app.get('/_controle/alfa', (_req, res) => {
  res.json(config);
});

app.post('/_controle/alfa', (req, res) => {
  const corpo = req.body ?? {};
  if (typeof corpo.simularFalhas === 'boolean') config.simularFalhas = corpo.simularFalhas;
  if (typeof corpo.limitePorMinuto === 'number' && corpo.limitePorMinuto > 0) {
    config.limitePorMinuto = corpo.limitePorMinuto;
  }
  if (typeof corpo.probabilidadeFalha500 === 'number' && corpo.probabilidadeFalha500 >= 0) {
    config.probabilidadeFalha500 = corpo.probabilidadeFalha500;
  }
  if (typeof corpo.latenciaMinMs === 'number' && corpo.latenciaMinMs >= 0) {
    config.latenciaMinMs = corpo.latenciaMinMs;
  }
  if (typeof corpo.latenciaMaxMs === 'number' && corpo.latenciaMaxMs >= config.latenciaMinMs) {
    config.latenciaMaxMs = corpo.latenciaMaxMs;
  }
  console.log('[mock-controle] configuração do Alfa atualizada:', config);
  res.json(config);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORTA, () => {
  console.log(
    `Mock dos parceiros ouvindo na porta ${PORTA}. ` +
      `Alfa: ${carteira.length} clientes, falhas simuladas: ${config.simularFalhas}, limite: ${config.limitePorMinuto}/min. ` +
      `Beta: ${TAMANHO_CARTEIRA_BETA} linhas em /beta/carteira.csv. ` +
      `Controle em tempo real: GET/POST /_controle/alfa.`,
  );
});
