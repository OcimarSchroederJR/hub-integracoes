# Hub de Integrações com Parceiros

[![CI](https://github.com/OcimarSchroederJR/hub-integracoes/actions/workflows/ci.yml/badge.svg)](https://github.com/OcimarSchroederJR/hub-integracoes/actions/workflows/ci.yml)

Serviço backend que recebe carteiras de cobrança de parceiros com formatos e protocolos distintos, normaliza os dados em um modelo canônico único e processa cada registro de forma assíncrona, com garantia de idempotência e recuperação de falhas.

`NestJS` · `BullMQ` · `MySQL` · `DynamoDB` · `AWS` · `Docker`

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
- [ ] Fase 3 — em andamento. Feito: payload bruto de cada página arquivado em S3/LocalStack antes de qualquer transformação (RF02); trilha de eventos em DynamoDB por registro, com `correlationId` propagado de ponta a ponta e log estruturado em JSON (RF07, RNF06); `/health` verificando banco, fila e armazenamento. Falta: métricas Prometheus e Grafana, deploy.

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

Dispare uma importação e acompanhe:

```bash
curl -X POST http://localhost:3000/integracoes/alfa/execucoes
# ou: curl -X POST http://localhost:3000/integracoes/beta/execucoes
curl http://localhost:3000/execucoes/{execucaoId}
curl "http://localhost:3000/execucoes/{execucaoId}/registros?situacao=REJEITADO"
```

Se um registro ficar `FALHA` (esgotou as tentativas) ou `REJEITADO`, reprocesse com o payload bruto já arquivado, sem nova chamada ao parceiro:

```bash
curl -X POST http://localhost:3000/execucoes/{execucaoId}/reprocessar
curl -X POST http://localhost:3000/registros/{registroId}/reprocessar
```

Para reconstruir a história de um registro específico:

```bash
curl http://localhost:3000/registros/{registroId}/eventos
```

Painel Grafana em `http://localhost:3001`, usuário `admin` e senha `admin`. (Fase 3.)

---

## O que observar enquanto roda

O mock dos parceiros falha de propósito. O Alfa devolve 429 acima de 60 requisições por minuto, 500 em cerca de 5 por cento das chamadas, latência aleatória de até 3 segundos e cerca de 10 por cento dos clientes com defeito de dado (documento inválido ou sem nenhum contrato). O Beta entrega um CSV com campo obrigatório vazio, data 31/02, valor não numérico e uma linha duplicada. Um importador ingênuo quebra nesse cenário. O comportamento esperado aqui é outro.

O limitador da fila de coleta impede que o 429 aconteça, mesmo com a carteira sendo puxada o mais rápido possível.

O 500 do parceiro é retentado com backoff exponencial. Se as tentativas se esgotarem, o registro vira `FALHA` com o payload bruto preservado, pronto para `POST /registros/{id}/reprocessar` sem nova chamada ao parceiro. Uma página de coleta que esgota as tentativas deixa a execução presa em `PROCESSANDO` — o [runbook](docs/RUNBOOK.md) descreve como diagnosticar e recuperar manualmente; não há reenfileiramento automático ainda.

O registro com documento inválido é rejeitado sozinho, com motivo legível, e os outros seguem sendo processados.

Rodar a mesma importação três vezes mantém a contagem de dívidas constante, porque a chave de idempotência tem restrição única no banco. Duas chamadas simultâneas de disparo para o mesmo parceiro também não criam execução duplicada, pela mesma razão: a trava é uma restrição única (`ExecucaoAtiva.parceiroId`), não uma consulta seguida de inserção.

Quando a situação de uma dívida muda entre duas importações, o hub enfileira o envio da atualização ao parceiro de origem no formato que ele espera — `POST` para o Alfa, webhook para o Beta — sem que o domínio saiba dessa diferença.

Cada página coletada é gravada íntegra em `raw/{parceiro}/{execucaoId}/{sequencial}.{json,csv}` no S3 (LocalStack em desenvolvimento) antes de qualquer transformação. Uma execução que falha na normalização ainda deixa o payload bruto disponível para inspeção — verifique com `docker exec <container-do-localstack> awslocal s3 ls s3://hub-raw-payloads/raw/alfa/{execucaoId}/`.

Cada transição de um registro — persistido, rejeitado, falhou, atualização enviada — grava um evento na trilha do DynamoDB, com o mesmo `correlationId` da execução que o gerou. `GET /registros/{id}/eventos` devolve a história completa daquele registro em ordem cronológica, sem tocar no MySQL. Todo log da aplicação sai em JSON com esse `correlationId`, então filtrar por ele nos logs e na trilha aponta para o mesmo evento visto de dois ângulos.

O painel mostra profundidade de fila, taxa de rejeição por parceiro e latência do parceiro durante tudo isso. (Fase 3.)

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

Complementos: [contrato de normalização](docs/CONTRATO_DE_NORMALIZACAO.md), [runbook operacional](docs/RUNBOOK.md), [benchmark](docs/BENCHMARK.md).

---

## Limitações conhecidas

Estas são escolhas conscientes de escopo, não itens esquecidos.

Não há autenticação na API interna. O serviço é desenhado para rodar atrás de um gateway. Implementar JWT aqui adicionaria código sem exercitar nenhuma competência de integração.

O fluxo de saída não tem confirmação de entrega. Se o parceiro aceita o `POST` e depois perde a mensagem internamente, o hub não descobre. A solução correta seria conciliação periódica comparando situação local e remota, descrita mas não implementada.

A trilha de eventos em DynamoDB não tem política de expiração. Em volume real, cresce indefinidamente e precisaria de TTL.

O reprocessamento em massa não tem limite de taxa próprio. Reprocessar uma execução de 100 mil registros enfileira tudo de uma vez e pode pressionar o parceiro.

Uma página de coleta que esgota as cinco tentativas de retry não tem recuperação automática: a execução fica presa em `PROCESSANDO` até alguém reenfileirar manualmente o job com o cursor da última página bem-sucedida, como o [runbook](docs/RUNBOOK.md) descreve. Isso foi encontrado testando o mock com falha simulada, não é hipotético.

Os testes de integração (`npm run test:e2e`) sobem os próprios containers de MySQL, Redis e LocalStack (S3 + DynamoDB) via `dockerode`, direto, sem a biblioteca `testcontainers`: ela tem uma incompatibilidade conhecida com o Docker Desktop no Windows por named pipe (falha em "create container" mesmo com o container auxiliar de limpeza desabilitado). Rodam localmente em Linux/macOS e no [CI](.github/workflows/ci.yml).

---

## Convenção de commits

`tipo(escopo): descrição no imperativo`, com corpo explicando o porquê quando a decisão não for óbvia. Tipos usados: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
