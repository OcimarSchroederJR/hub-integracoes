# Hub de Integrações com Parceiros

[![CI](https://github.com/OcimarSchroederJR/hub-integracoes/actions/workflows/ci.yml/badge.svg)](https://github.com/OcimarSchroederJR/hub-integracoes/actions/workflows/ci.yml)

Serviço backend que recebe carteiras de cobrança de parceiros com formatos e protocolos distintos, normaliza os dados em um modelo canônico único e processa cada registro de forma assíncrona, com garantia de idempotência e recuperação de falhas.

`NestJS` · `BullMQ` · `MySQL` · `DynamoDB` · `AWS` · `Prometheus` · `Grafana` · `Docker`

---

## O problema

Dois parceiros entregam exatamente a mesma informação de maneiras incompatíveis.

| | Parceiro Alfa | Parceiro Beta |
|---|---|---|
| Transporte | API REST paginada por cursor | Arquivo CSV |
| Codificação | UTF-8 | latin-1 |
| Valores | centavos como inteiro | `1.580,00` |
| Datas | `2024-03-15` | `15/03/2024` |
| Documento | apenas dígitos | ora com máscara, ora sem |
| Retorno | `POST` autenticado | webhook em formato próprio |

Escrever um importador para cada parceiro funciona com dois. Com doze, vira doze bases de código para manter. Este projeto resolve isso confinando toda diferença em uma camada de adaptadores, de modo que o domínio nunca saiba de qual parceiro o dado veio.

**Incluir um terceiro parceiro custa um diretório novo em `src/parceiros` e uma linha em `RegistroAdaptadores`. Nenhum arquivo de `src/dominio` ou `src/integracao` é alterado.** O procedimento está em [docs/NOVO_PARCEIRO.md](docs/NOVO_PARCEIRO.md).

---

## Status do projeto

Em desenvolvimento, seguindo o roadmap em fases de [docs/REQUISITOS_HUB_INTEGRACOES.md](docs/REQUISITOS_HUB_INTEGRACOES.md). Esta seção é atualizada a cada marco concluído.

- [x] Fase 1 — esqueleto: NestJS, docker compose, mock Alfa sem falhas, adaptador Alfa, fila de normalização, endpoints básicos. Marco verificado: uma chamada importa os 500 registros da carteira mock e o banco reflete os dados corretamente, com a mesma importação repetida três vezes seguidas mantendo a contagem de dívidas constante.
- [x] Fase 2 — mock Alfa com 429/500/latência/dado inválido de verdade, adaptador Beta (CSV, latin-1, vírgula decimal, data brasileira), fila de mortos, reprocessamento manual, envio de atualização nos dois formatos, testes de integração com MySQL e Redis reais em CI. Marco verificado: a mesma carteira importada três vezes não duplica dívida, um lote com registro defeituoso rejeita só ele, e duas chamadas simultâneas de disparo não criam execução duplicada — os três com teste automatizado rodando de verdade no pipeline, não só localmente.
- [x] Fase 3 — payload bruto de cada página arquivado em S3/LocalStack antes de qualquer transformação (RF02); trilha de eventos em DynamoDB por registro, com `correlationId` propagado de ponta a ponta e log estruturado em JSON (RF07, RNF06); `/health` verificando banco, fila e armazenamento; `GET /metrics` em formato Prometheus e painel Grafana provisionado como código (RF12, RNF06). Deploy em nuvem foi deixado de fora por decisão consciente de escopo — ver Limitações conhecidas.

---

## Rodando

```bash
git clone <url-do-repositorio>
cd hub-integracoes
cp .env.example .env
docker compose up -d
npm install && npx prisma migrate deploy && npm run seed
npm run start:dev
```

A API exige login (ver [ADR 0006](docs/adr/0006-autenticacao-jwt-com-usuario-seed.md)) — exceto `/health` e `/metrics`. O `npm run seed` acima já criou o usuário admin a partir de `ADMIN_EMAIL`/`ADMIN_SENHA` do `.env`. Autentique e guarde o token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hub.local","senha":"admin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
```

Dispare uma importação e acompanhe:

```bash
curl -X POST http://localhost:3000/integracoes/alfa/execucoes -H "Authorization: Bearer $TOKEN"
# ou: curl -X POST http://localhost:3000/integracoes/beta/execucoes -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/execucoes/{execucaoId} -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/execucoes/{execucaoId}/registros?situacao=REJEITADO" -H "Authorization: Bearer $TOKEN"
```

Se um registro ficar `FALHA` (esgotou as tentativas) ou `REJEITADO`, reprocesse com o payload bruto já arquivado, sem nova chamada ao parceiro:

```bash
curl -X POST http://localhost:3000/execucoes/{execucaoId}/reprocessar -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3000/registros/{registroId}/reprocessar -H "Authorization: Bearer $TOKEN"
```

Para reconstruir a história de um registro específico:

```bash
curl http://localhost:3000/registros/{registroId}/eventos -H "Authorization: Bearer $TOKEN"
```

Painel Grafana em `http://localhost:3001`, usuário `admin` e senha `admin`. Métricas cruas em `curl http://localhost:3000/metrics`, formato Prometheus — junto com `/health`, é a única rota que não exige login.

---

## O que observar enquanto roda

Os valores de fatura/dívida do mock não são gerados por fórmula: vêm de uma amostra real do dataset público [Default of Credit Card Clients](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) (UCI Machine Learning Repository, Yeh & Lien, 2009), embutida em [mock-parceiros/data/creditos-reais.csv](mock-parceiros/data/creditos-reais.csv). Nome, CPF, telefone e e-mail continuam sintéticos — o dataset é anonimizado e não tem esses campos, então não existe combinação "100% real" possível aqui sem violar a privacidade de gente de verdade. A situação de cada dívida (`EM_ATRASO`/`EM_NEGOCIACAO`/`QUITADA`/`CANCELADA`) também deriva desse dataset real, em vez de sortear entre as quatro opções: quem o dataset marca como inadimplente no mês seguinte vira `EM_ATRASO`; entre quem não é, quem já pagou o valor integral vira `QUITADA`, quem não pagou nada vira `CANCELADA`, e quem pagou parte vira `EM_NEGOCIACAO`.

O mock dos parceiros falha de propósito. O Alfa devolve 429 acima de 60 requisições por minuto, 500 em cerca de 5 por cento das chamadas, latência aleatória de até 3 segundos e cerca de 10 por cento dos clientes com defeito de dado (documento inválido ou sem nenhum contrato). O Beta entrega um CSV com campo obrigatório vazio, data 31/02, valor não numérico e uma linha duplicada. Um importador ingênuo quebra nesse cenário. O comportamento esperado aqui é outro.

O limitador da fila de coleta impede que o 429 aconteça, mesmo com a carteira sendo puxada o mais rápido possível.

O 500 do parceiro é retentado com backoff exponencial. Se as tentativas se esgotarem, o registro vira `FALHA` com o payload bruto preservado, pronto para `POST /registros/{id}/reprocessar` sem nova chamada ao parceiro. Uma página de coleta que esgota as tentativas deixa a execução presa em `PROCESSANDO` — o [runbook](docs/RUNBOOK.md) descreve como diagnosticar e recuperar manualmente; não há reenfileiramento automático ainda.

O registro com documento inválido é rejeitado sozinho, com motivo legível, e os outros seguem sendo processados.

Rodar a mesma importação três vezes mantém a contagem de dívidas constante, porque a chave de idempotência tem restrição única no banco. Duas chamadas simultâneas de disparo para o mesmo parceiro também não criam execução duplicada, pela mesma razão: a trava é uma restrição única (`ExecucaoAtiva.parceiroId`), não uma consulta seguida de inserção.

Quando a situação de uma dívida muda entre duas importações, o hub enfileira o envio da atualização ao parceiro de origem no formato que ele espera — `POST` para o Alfa, webhook para o Beta — sem que o domínio saiba dessa diferença.

Cada página coletada é gravada íntegra em `raw/{parceiro}/{execucaoId}/{sequencial}.{json,csv}` no S3 (LocalStack em desenvolvimento) antes de qualquer transformação. Uma execução que falha na normalização ainda deixa o payload bruto disponível para inspeção — verifique com `docker exec <container-do-localstack> awslocal s3 ls s3://hub-raw-payloads/raw/alfa/{execucaoId}/`.

Cada transição de um registro — persistido, rejeitado, falhou, atualização enviada — grava um evento na trilha do DynamoDB, com o mesmo `correlationId` da execução que o gerou. `GET /registros/{id}/eventos` devolve a história completa daquele registro em ordem cronológica, sem tocar no MySQL. Todo log da aplicação sai em JSON com esse `correlationId`, então filtrar por ele nos logs e na trilha aponta para o mesmo evento visto de dois ângulos.

O painel Grafana ("Hub de Integrações", provisionado como código em [observabilidade/grafana](observabilidade/grafana)) mostra profundidade de cada fila, registros processados por parceiro e resultado, duração p95 de chamada externa e fila de mortos — as quatro métricas mínimas da RNF06, raspadas do Prometheus a cada 10s.

---

## Além do escopo original

Depois da Fase 3, cinco funcionalidades foram acrescentadas por iniciativa própria — não pedidas pelos requisitos nem pelos ADRs — para explorar problemas de integração que o roadmap original não cobria.

**Painel de controle ao vivo do mock.** `GET /_controle/alfa` e `POST /_controle/alfa` (no mock, porta 4000) leem e ajustam em tempo real a taxa de erro simulada, a latência e o limite de requisições do Alfa, sem reiniciar o container — útil para forçar cenários de falha sob demanda em vez de esperar a aleatoriedade padrão.

**Limitador de requisições adaptativo.** O `AlfaAdapter` mantém um atraso interno que cresce geometricamente a cada 429/500 recebido e decai pela metade a cada sucesso, independente do limitador estático do BullMQ. Visível na métrica `hub_atraso_adaptativo_ms` (Prometheus/Grafana) e nos logs (`Recebi 500 do Alfa, aumentando atraso adaptativo para...`).

**Outbox de eventos para consumidores internos.** Todo evento que já ia para a trilha do DynamoDB agora também é publicado numa fila BullMQ dedicada (`eventos-saida`), via `EventosOutboxService`. Existe um processor de demonstração (`EventosOutboxAssinanteProcessor`) que só loga o que recebe, no lugar de um consumidor interno real — o ponto é mostrar o padrão, não implementar um consumidor específico.

**Detecção de sobreposição entre parceiros.** Quando o mesmo devedor (mesmo documento) tem dívidas ativas em dois parceiros diferentes com valor atualizado parecido (tolerância de 10%), o hub grava uma linha em `SobreposicaoDetectada` para revisão manual — não decide nem cancela nada. Consulte com `GET /devedores/sobreposicoes`. Os dados gerados por padrão pelo mock já incluem uma sobreposição proposital (cliente 0 do Alfa e do Beta compartilham o mesmo documento) para dar para testar isso de ponta a ponta sem precisar montar cenário manualmente.

**CLI administrativo.** Um cliente de linha de comando para a API do hub, em [cli/](cli/), independente do backend (`commander` + `axios`, próprio `package.json`/build, no mesmo padrão do `mock-parceiros/`):

```bash
cd cli && npm install && npm run build
node dist/index.js login admin@hub.local admin123
node dist/index.js execucoes:disparar alfa
node dist/index.js execucoes:status <id>
node dist/index.js sobreposicoes:listar
node dist/index.js --help
```

Aponta para `http://localhost:3000` por padrão; mude com a variável `HUB_API_URL`. `login` guarda o token em `~/.hub-cli/token` e os outros comandos o usam automaticamente; `logout` apaga o token salvo.

---

## Decisões de projeto

As escolhas relevantes estão registradas como ADR, com contexto, alternativas descartadas e consequências.

| ADR | Decisão |
|---|---|
| [0001](docs/adr/0001-modelo-canonico-e-adaptadores.md) | Modelo canônico com adaptadores por parceiro |
| [0002](docs/adr/0002-idempotencia-no-banco.md) | Idempotência por restrição única, não por verificação em código |
| [0003](docs/adr/0003-paginacao-via-fila.md) | Paginação propagada pela fila em vez de laço dentro do job |
| [0004](docs/adr/0004-mysql-e-dynamodb.md) | MySQL para o estado, DynamoDB para a trilha de eventos |
| [0005](docs/adr/0005-erro-de-dado-vs-erro-de-infra.md) | Erro de dado rejeita, erro de infraestrutura retenta |
| [0006](docs/adr/0006-autenticacao-jwt-com-usuario-seed.md) | Autenticação JWT com usuário único via seed |

Complementos: [contrato de normalização](docs/CONTRATO_DE_NORMALIZACAO.md), [runbook operacional](docs/RUNBOOK.md), [benchmark](docs/BENCHMARK.md), [uso de IA no desenvolvimento](docs/USO_DE_IA.md).

---

## Limitações conhecidas

Estas são escolhas conscientes de escopo, não itens esquecidos.

A autenticação (JWT, [ADR 0006](docs/adr/0006-autenticacao-jwt-com-usuario-seed.md)) não tem refresh token, rate limiting no login nem revogação antes da expiração — aceitável para uma ferramenta interna de portfólio, não para uma API exposta publicamente sem mitigação adicional.

O fluxo de saída não tem confirmação de entrega. Se o parceiro aceita o `POST` e depois perde a mensagem internamente, o hub não descobre. A solução correta seria conciliação periódica comparando situação local e remota, descrita mas não implementada.

A trilha de eventos em DynamoDB não tem política de expiração. Em volume real, cresce indefinidamente e precisaria de TTL.

O reprocessamento em massa não tem limite de taxa próprio. Reprocessar uma execução de 100 mil registros enfileira tudo de uma vez e pode pressionar o parceiro.

Uma página de coleta que esgota as cinco tentativas de retry não tem recuperação automática: a execução fica presa em `PROCESSANDO` até alguém reenfileirar manualmente o job com o cursor da última página bem-sucedida, como o [runbook](docs/RUNBOOK.md) descreve. Isso foi encontrado testando o mock com falha simulada, não é hipotético.

Os testes de integração (`npm run test:e2e`) sobem os próprios containers de MySQL, Redis e LocalStack (S3 + DynamoDB) via `dockerode`, direto, sem a biblioteca `testcontainers`: ela tem uma incompatibilidade conhecida com o Docker Desktop no Windows por named pipe (falha em "create container" mesmo com o container auxiliar de limpeza desabilitado). Rodam localmente em Linux/macOS e no [CI](.github/workflows/ci.yml).

Não há deploy em nuvem. O sistema roda via `docker compose` local e no CI; ECS Fargate/EC2 com Secrets Manager, previstos no roadmap original, exigiriam uma conta AWS real e custo recorrente, o que não faz sentido para manter ligado permanentemente num projeto de portfólio. O [`Dockerfile`](Dockerfile) do hub já builda e roda de ponta a ponta (testado manualmente contra o `docker-compose.yml` local), variáveis de ambiente são validadas na inicialização, e `AWS_ENDPOINT` é opcional — sem ele o SDK aponta pro S3/DynamoDB reais em vez do LocalStack. Falta só apontar isso para uma conta AWS de verdade.

---

## Convenção de commits

`tipo(escopo): descrição no imperativo`, com corpo explicando o porquê quando a decisão não for óbvia. Tipos usados: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
