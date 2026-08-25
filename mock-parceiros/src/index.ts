import express from 'express';
import { gerarCarteira } from './dados';

const app = express();
app.use(express.json());

const PORTA = Number(process.env.PORT) || 4000;
const TAMANHO_CARTEIRA = Number(process.env.ALFA_TAMANHO_CARTEIRA) || 500;
const carteira = gerarCarteira(TAMANHO_CARTEIRA);

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

app.get('/v1/portfolio', (req, res) => {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'token ausente' });
    return;
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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORTA, () => {
  console.log(`Mock do Parceiro Alfa ouvindo na porta ${PORTA}, carteira com ${carteira.length} clientes`);
});
