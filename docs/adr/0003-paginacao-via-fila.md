# ADR 0003 — Paginação propagada pela fila

**Situação:** aceita
**Data:** 2026-08-24

## Contexto

A API do Parceiro Alfa é paginada por cursor e limitada a 60 requisições por minuto. Exceder o limite devolve 429. Uma carteira de 500 registros em páginas de 100 exige cinco chamadas encadeadas, cada uma dependendo do cursor da anterior.

## Decisão

Cada página é um job próprio na fila `coleta`. O job busca uma página, enfileira os itens para normalização e, se houver próximo cursor, enfileira um novo job de coleta com esse cursor. A paginação se propaga pela fila.

O limite de requisições é aplicado pelo `limiter` do worker BullMQ, configurado com `max: 60` e `duration: 60000`, junto de `concurrency: 1`.

## Alternativas consideradas

**Laço `while (hasMore)` dentro de um único job.** Descartada por três razões. O job vira longo e uma falha na página 47 perde o progresso das 46 anteriores. O limitador do BullMQ atua sobre jobs, não sobre chamadas HTTP internas, então ele não teria efeito nenhum. E não há visibilidade: a fila mostra um job rodando, sem indicação de progresso.

**Limitador implementado no cliente HTTP com token bucket próprio.** Descartada porque duplica em código uma funcionalidade que a fila já oferece testada, e porque não sobrevive a múltiplas instâncias da aplicação. O limitador do BullMQ é compartilhado via Redis e vale para o processo inteiro.

**Buscar todas as páginas em paralelo.** Impossível com paginação por cursor, já que a página seguinte só é conhecida após a resposta da anterior. Seria viável com paginação por deslocamento, ao custo de estourar o limite de requisições.

## Consequências

**Positivas.** Falha em uma página é retentada isoladamente, sem perder o já coletado. O limite do parceiro é respeitado por construção e sobrevive a múltiplas instâncias. O progresso é observável na profundidade da fila.

**Negativas.** A conclusão da execução deixa de ser óbvia. Não existe mais um ponto no código onde o laço termina, então foi preciso introduzir a marca `coletaConcluida` e a comparação entre total recebido e total resolvido. Essa lógica é a parte mais delicada do sistema e concentra o risco de execução travada em `PROCESSANDO`, tratado no runbook.

Com `concurrency: 1` na coleta, a importação é sequencial por parceiro. Parceiros distintos ainda coletam em paralelo, porque cada um tem sua própria execução, mas duas carteiras do mesmo parceiro não. Aceitável enquanto uma execução por parceiro for a regra, garantida pelo 409 em execução concorrente.
