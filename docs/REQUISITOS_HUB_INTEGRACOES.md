# Hub de Integrações com Parceiros

**Documento de Requisitos — v1.0**
Projeto pessoal de portfólio. Autor: Ocimar Schroeder.

---

## 1. Visão geral

O sistema é um serviço backend que recebe carteiras de cobrança de parceiros externos com formatos e protocolos distintos, normaliza os dados em um modelo canônico interno, processa cada registro de forma assíncrona e devolve o resultado das negociações ao parceiro de origem.

O objetivo técnico do projeto é demonstrar domínio de integração entre sistemas heterogêneos, processamento assíncrono com filas, idempotência, observabilidade e tratamento de falhas em cenários que se aproximam de um ambiente produtivo.

### 1.1 Problema que o sistema resolve

Cada parceiro entrega os mesmos dados de forma diferente. Um usa API REST com JSON em camelCase e valores em centavos. Outro entrega CSV em latin-1 com valores em formato brasileiro e datas em dd/mm/aaaa. O núcleo do sistema não pode conhecer nenhuma dessas particularidades. Toda diferença fica confinada em uma camada de adaptadores, de modo que incluir um terceiro parceiro custe um arquivo novo e nenhuma alteração no domínio.

### 1.2 Fora de escopo

Não fazem parte deste projeto interface gráfica, motor de negociação automatizada, envio real de mensagens a devedores, autenticação de usuários finais e multi-tenancy. A API é consumida por ferramenta de linha de comando ou cliente HTTP.

---

## 2. Glossário

| Termo | Definição |
|---|---|
| Parceiro | Empresa externa que envia carteiras de cobrança ao sistema |
| Carteira | Conjunto de dívidas enviado por um parceiro em uma remessa |
| Execução de integração | Uma rodada completa de importação de uma carteira de um parceiro |
| Registro | Uma dívida individual dentro de uma execução |
| Modelo canônico | Representação interna e única dos dados, independente do parceiro de origem |
| Adaptador | Componente que traduz o formato de um parceiro específico para o modelo canônico e vice-versa |
| Payload bruto | Conteúdo recebido do parceiro antes de qualquer transformação |
| Chave de idempotência | Identificador determinístico que impede a criação de registros duplicados |

---

## 3. Atores e integrações externas

**Operador.** Dispara execuções, consulta status e solicita reprocessamento por meio da API interna.

**Parceiro Alfa.** Sistema fictício que expõe API REST. Autenticação por Bearer token, paginação por cursor, limite de 60 requisições por minuto, JSON em camelCase, valores monetários em centavos como inteiro, datas em ISO 8601. Recebe atualizações de status por requisição POST.

**Parceiro Beta.** Sistema fictício que entrega arquivo CSV. Codificação latin-1, separador ponto e vírgula, cabeçalho em português maiúsculo, valores com vírgula decimal e separador de milhar, datas em dd/mm/aaaa, documento ora com máscara ora sem. Recebe atualizações de status por webhook em formato próprio.

Ambos os parceiros são implementados como serviço mock dentro do próprio repositório, subindo junto no docker compose.

---

## 4. Contratos dos parceiros

### 4.1 Parceiro Alfa, entrada

Endpoint `GET /v1/portfolio?cursor={cursor}&limit=100`, cabeçalho `Authorization: Bearer {token}`.

```json
{
  "data": [
    {
      "externalId": "ALF-0000123",
      "taxId": "52998224725",
      "customerName": "Maria Souza",
      "contracts": [
        {
          "contractNumber": "CT-99182",
          "originalAmountCents": 158000,
          "currentAmountCents": 213450,
          "dueDate": "2024-03-15",
          "status": "OVERDUE"
        }
      ],
      "contacts": {
        "phones": ["5581998805965"],
        "emails": ["maria@exemplo.com"]
      },
      "updatedAt": "2026-08-20T14:03:00Z"
    }
  ],
  "nextCursor": "eyJpZCI6MTIzfQ==",
  "hasMore": true
}
```

Comportamentos que o mock deve simular de propósito, porque são a razão de existir do projeto: resposta 429 quando o limite de requisições é excedido, latência aleatória entre 100 e 3000 milissegundos, falha 500 intermitente em cerca de 5 por cento das chamadas, e presença ocasional de registro com `taxId` inválido ou `contracts` vazio.

### 4.2 Parceiro Alfa, saída

`POST /v1/portfolio/{externalId}/status` com corpo `{ "contractNumber": "...", "newStatus": "IN_NEGOTIATION", "occurredAt": "..." }`. Resposta 202 em caso de sucesso.

### 4.3 Parceiro Beta, entrada

Arquivo `carteira_YYYYMMDD.csv`.

```
CPF_CNPJ;NOME_CLIENTE;NUM_CONTRATO;VLR_ORIGINAL;VLR_ATUALIZADO;DT_VENCIMENTO;TELEFONE;SITUACAO
529.982.247-25;MARIA SOUZA;CT-99182;1.580,00;2.134,50;15/03/2024;(81) 99880-5965;EM ATRASO
52998224725;JOAO LIMA;CT-77321;890,00;1.002,30;02/11/2023;81 3222-1010;EM ATRASO
```

O mock deve gerar linhas com defeito proposital: campo obrigatório vazio, data inválida como 31/02/2024, valor não numérico, e linha duplicada dentro do mesmo arquivo.

### 4.4 Parceiro Beta, saída

`POST` no webhook configurado, com corpo `{ "numContrato": "...", "situacao": "EM NEGOCIACAO", "dataEvento": "20/08/2026 14:03" }`.

---

## 5. Modelo canônico

O domínio interno não conhece nenhum campo dos contratos acima.

```
Devedor
  id
  documento          string, apenas dígitos, validado como CPF ou CNPJ
  nome               string
  telefones          lista de strings em formato E.164
  emails             lista de strings

Divida
  id
  devedorId
  parceiroId
  numeroContrato     string
  valorOriginal      inteiro, em centavos
  valorAtualizado    inteiro, em centavos
  dataVencimento     data
  diasAtraso         inteiro, calculado
  situacao           enum: EM_ATRASO, EM_NEGOCIACAO, QUITADA, CANCELADA
  chaveIdempotencia  string, única
```

Regras de normalização obrigatórias. Documento sempre reduzido a dígitos e validado por dígito verificador. Valores monetários sempre convertidos para centavos como inteiro, nunca ponto flutuante. Datas sempre convertidas para ISO 8601 em UTC. Telefones sempre convertidos para E.164 assumindo Brasil quando não houver código de país. Situação sempre mapeada para o enum interno por meio de tabela de tradução declarada no adaptador.

---

## 6. Requisitos funcionais

### RF01 — Disparar execução de integração

O operador dispara a importação da carteira de um parceiro por `POST /integracoes/:parceiro/execucoes`. O sistema cria uma execução com situação PENDENTE, gera um `correlationId` e retorna 202 com o identificador da execução.

*Critério de aceite.* A resposta é imediata e não aguarda o processamento. Duas chamadas simultâneas para o mesmo parceiro não criam execuções concorrentes; a segunda recebe 409.

### RF02 — Arquivar payload bruto antes de qualquer transformação

Todo conteúdo recebido do parceiro é gravado íntegro em armazenamento de objetos antes do parse, sob a chave `raw/{parceiro}/{execucaoId}/{sequencial}.{ext}`.

*Critério de aceite.* Uma execução que falha na normalização ainda deixa o payload bruto disponível para inspeção.

### RF03 — Coletar dados do parceiro respeitando paginação e limites

O adaptador percorre todas as páginas até `hasMore` ser falso, respeitando o limite de requisições por minuto definido na configuração do parceiro.

*Critério de aceite.* Com limite de 60 por minuto e carteira de 500 registros em páginas de 100, o sistema não recebe 429 em nenhuma chamada.

### RF04 — Normalizar registros para o modelo canônico

Cada registro é convertido para o modelo canônico pelo adaptador do parceiro correspondente. O núcleo recebe apenas o modelo canônico.

*Critério de aceite.* O mesmo devedor enviado por Alfa e por Beta produz objetos canônicos idênticos nos campos documento, nome, valores e datas.

### RF05 — Validar e rejeitar registro inválido sem derrubar o lote

Registro com documento inválido, campo obrigatório ausente, data impossível ou valor não numérico é marcado como REJEITADO com o motivo registrado. O restante do lote continua sendo processado.

*Critério de aceite.* Um arquivo com 100 linhas e 7 defeituosas resulta em 93 registros persistidos e 7 rejeitados com motivo legível.

### RF06 — Garantir idempotência

A chave de idempotência é derivada de parceiro, identificador externo e número do contrato. Reprocessar a mesma carteira duas vezes atualiza os registros existentes e não cria duplicidade.

*Critério de aceite.* Executar a mesma importação três vezes seguidas mantém a contagem de dívidas constante no banco. Existe restrição de unicidade no banco, e não apenas verificação em código.

### RF07 — Registrar trilha de eventos por registro

Cada transição relevante de um registro gera um evento imutável contendo execução, registro, tipo do evento, momento, `correlationId` e detalhe.

*Critério de aceite.* É possível reconstruir a história completa de um registro consultando apenas a trilha de eventos.

### RF08 — Tratar falhas com retry e fila de mortos

Falha transitória em chamada externa gera nova tentativa com backoff exponencial, até o limite configurado. Esgotadas as tentativas, o item vai para a fila de mortos com o erro preservado.

*Critério de aceite.* Com o mock respondendo 500 nas duas primeiras tentativas e 200 na terceira, o registro é concluído com sucesso e a trilha mostra as três tentativas.

### RF09 — Reprocessar manualmente

`POST /execucoes/:id/reprocessar` reenfileira todos os registros em falha da execução. `POST /registros/:id/reprocessar` reenfileira um único registro.

*Critério de aceite.* O reprocessamento respeita a idempotência definida em RF06.

### RF10 — Consultar situação da execução

`GET /execucoes/:id` retorna situação, contagens por resultado, momento de início e fim, e duração. `GET /execucoes/:id/registros?situacao=REJEITADO` lista os registros filtrados com o motivo.

### RF11 — Devolver atualização de situação ao parceiro

Quando a situação de uma dívida muda internamente, o sistema enfileira o envio da atualização ao parceiro de origem, no formato que aquele parceiro espera.

*Critério de aceite.* A mesma mudança interna gera uma chamada `POST /v1/portfolio/...` para Alfa e uma chamada de webhook em formato brasileiro para Beta, sem que o domínio saiba dessa diferença.

### RF12 — Expor métricas e saúde

`GET /health` verifica banco, Redis e armazenamento de objetos. `GET /metrics` expõe métricas em formato Prometheus.

---

## 7. Requisitos não funcionais

**RNF01 — Arquitetura.** NestJS com módulos por contexto. O módulo de domínio não importa nada dos módulos de parceiros. Cada adaptador implementa a interface `ParceiroAdapter` com os métodos `coletar`, `normalizar` e `enviarAtualizacao`. A escolha do adaptador é feita por injeção baseada em token, nunca por condicional encadeada.

**RNF02 — Filas.** BullMQ sobre Redis, com filas nomeadas por etapa: `ingestao`, `normalizacao`, `envio`. Concorrência configurável por fila via variável de ambiente. Limitador de requisições configurado por parceiro. Retry com backoff exponencial e jitter, cinco tentativas por padrão. Fila de mortos habilitada em todas.

**RNF03 — Persistência relacional.** MySQL com migrations versionadas e reversíveis. Nenhuma alteração de esquema aplicada manualmente. Restrição de unicidade sobre a chave de idempotência. Índices sobre parceiro, situação e data de vencimento.

**RNF04 — Persistência de eventos.** DynamoDB para a trilha de eventos, com chave de partição no identificador do registro e chave de ordenação no momento do evento. A escolha se justifica pelo volume de escrita e pelo esquema variável do detalhe.

**RNF05 — Armazenamento de objetos.** S3 para payloads brutos. Em desenvolvimento, LocalStack ou MinIO expondo a mesma API. Credenciais nunca no código; em produção, AWS Secrets Manager.

**RNF06 — Observabilidade.** Log estruturado em JSON com `correlationId` propagado de ponta a ponta. Métricas mínimas expostas: profundidade de cada fila, total de registros processados por parceiro e por resultado, duração das chamadas externas em histograma, e contagem de itens na fila de mortos. Painel Grafana provisionado como código no repositório.

**RNF07 — Testes.** Cobertura obrigatória nos normalizadores e nos validadores, que concentram a regra de negócio. Testes de integração com Testcontainers subindo MySQL e Redis reais. Chamadas HTTP externas interceptadas com nock. Pipeline de integração contínua no GitHub Actions rodando lint, testes e build a cada push.

**RNF08 — Configuração.** Toda configuração por variável de ambiente, validada na inicialização com schema. A aplicação recusa subir com configuração inválida. Arquivo `.env.example` versionado, `.env` nunca.

**RNF09 — Desempenho de referência.** Importação de 10 mil registros concluída em menos de 5 minutos com concorrência 10, no ambiente local.

**RNF10 — Uso de IA no fluxo.** Registrar em `docs/USO_DE_IA.md` como a IA foi usada para gerar adaptador a partir da documentação do parceiro, validar contrato, escrever casos de teste e revisar segurança, com exemplos de prompt e do que precisou ser corrigido manualmente.

---

## 8. Estrutura de pastas sugerida

```
src/
  dominio/
    entidades/
    servicos/
    portas/            interfaces ParceiroAdapter, RepositorioDivida, ArquivoBruto
  parceiros/
    alfa/              adapter, dto, mapeador, testes
    beta/              adapter, dto, mapeador, testes
  integracao/
    execucao.service.ts
    filas/
      ingestao.processor.ts
      normalizacao.processor.ts
      envio.processor.ts
  infra/
    mysql/             entidades TypeORM ou Prisma, migrations
    dynamo/
    s3/
    observabilidade/
  api/
    controllers/
mock-parceiros/        serviço separado, sobe no compose
docs/
  REQUISITOS.md
  USO_DE_IA.md
  NOVO_PARCEIRO.md
docker-compose.yml
```

---

## 9. Variáveis de ambiente

```
APP_PORT=3000
DATABASE_URL=mysql://user:pass@mysql:3306/hub
REDIS_HOST=redis
REDIS_PORT=6379
AWS_ENDPOINT=http://localstack:4566
AWS_REGION=us-east-1
S3_BUCKET_RAW=hub-raw-payloads
DYNAMO_TABLE_EVENTOS=hub-eventos
PARCEIRO_ALFA_BASE_URL=http://mock-parceiros:4000
PARCEIRO_ALFA_TOKEN=
PARCEIRO_ALFA_RATE_LIMIT_POR_MINUTO=60
PARCEIRO_BETA_WEBHOOK_URL=http://mock-parceiros:4000/beta/webhook
FILA_CONCORRENCIA_NORMALIZACAO=10
FILA_TENTATIVAS_MAXIMAS=5
LOG_LEVEL=info
```

---

## 10. Roadmap em fases

### Fase 1, o esqueleto que já vale como projeto

Objetivo: importar a carteira de um parceiro do início ao fim, com fila e persistência.

1. Projeto NestJS iniciado, docker compose com MySQL e Redis, configuração validada na inicialização.
2. Modelo canônico e migrations do MySQL.
3. Mock do Parceiro Alfa, ainda sem falhas simuladas.
4. Adaptador Alfa com coleta paginada e normalização.
5. Fila de normalização com BullMQ, um processador funcional.
6. `POST /integracoes/alfa/execucoes` e `GET /execucoes/:id`.
7. Testes unitários do normalizador Alfa.

*Marco de conclusão.* Uma chamada importa 500 registros e o banco reflete os dados corretamente.

### Fase 2, o que separa o projeto de um tutorial

8. Chave de idempotência com restrição de unicidade no banco.
9. Validação com rejeição individual e motivo registrado.
10. Retry com backoff, fila de mortos e endpoints de reprocessamento.
11. Mock do Alfa passando a simular 429, 500 e latência.
12. Adaptador Beta com CSV, incluindo latin-1, vírgula decimal e datas brasileiras.
13. Fluxo de saída com envio de atualização nos dois formatos.
14. Testes de integração com Testcontainers.

*Marco de conclusão.* Rodar a mesma importação três vezes mantém a contagem estável, e o mock falhando não derruba o processamento.

### Fase 3, o diferencial

15. Arquivamento do payload bruto em S3 via LocalStack.
16. Trilha de eventos em DynamoDB.
17. Métricas Prometheus e painel Grafana provisionado.
18. `correlationId` propagado e log estruturado.
19. GitHub Actions com lint, teste e build.
20. Deploy em ECS Fargate ou EC2, com Secrets Manager.
21. README, guia de novo parceiro e documento de uso de IA.

*Marco de conclusão.* O painel mostra profundidade de fila e taxa de falha por parceiro durante uma importação, e um terceiro parceiro poderia ser adicionado apenas escrevendo um arquivo novo.

---

## 11. Definição de pronto

O projeto está pronto para entrar no currículo quando todos os itens abaixo forem verdadeiros.

O comando `docker compose up` sobe o ambiente completo e o README descreve em menos de dez linhas como executar uma importação de ponta a ponta.

Os testes passam em pipeline pública e o badge está no README.

Reprocessar a mesma carteira não gera duplicidade, e isso é demonstrado por teste automatizado.

Uma falha simulada no parceiro é visível no painel Grafana e recuperável pelo endpoint de reprocessamento.

O histórico de commits mostra evolução em dias distintos, com mensagens que explicam decisão e não apenas o que mudou.

O documento `docs/NOVO_PARCEIRO.md` explica como incluir um terceiro parceiro, e essa explicação corresponde à realidade do código.
