# Benchmark

Números medidos, não estimados. Toda afirmação de desempenho no README aponta para cá.

---

## Ambiente

| Item | Valor |
|---|---|
| Máquina | PREENCHER |
| Node | PREENCHER |
| MySQL | 8.0 em contêiner, configuração padrão |
| Redis | 7 alpine em contêiner |
| Mock do parceiro | latência aleatória de 100 a 3000 ms, 5 por cento de 500, limite de 60 por minuto |

O mock roda na mesma máquina, então a latência de rede é irreal. As medições servem para comparar configurações entre si, não para prever desempenho em produção. Isso está declarado aqui de propósito.

---

## Metodologia

Cada rodada parte de banco limpo, com `prisma migrate reset` seguido de seed. A carteira tem PREENCHER registros. A medição vai do `POST` de início até a execução atingir situação `CONCLUIDA`, obtida pelo campo `duracaoMs`. Três rodadas por configuração, valor reportado é a mediana.

---

## Resultado por concorrência de normalização

| Concorrência | Duração | Vazão por segundo | Latência p95 do MySQL | Observação |
|---|---|---|---|---|
| 1 | PREENCHER | PREENCHER | PREENCHER | |
| 5 | PREENCHER | PREENCHER | PREENCHER | |
| 10 | PREENCHER | PREENCHER | PREENCHER | |
| 20 | PREENCHER | PREENCHER | PREENCHER | |
| 50 | PREENCHER | PREENCHER | PREENCHER | |

**Ponto de saturação observado:** PREENCHER.

**O que limita antes disso:** PREENCHER. Preencha com o que a medição mostrar. As candidatas prováveis são o tamanho do conjunto de conexões do Prisma, a contenção do `UPDATE` incremental no contador da execução, ou a própria latência do parceiro. Descobrir qual das três é o gargalo é o resultado mais valioso deste documento.

---

## Efeito do limitador de coleta

| Limite configurado | Duração da coleta | Respostas 429 |
|---|---|---|
| sem limitador | PREENCHER | PREENCHER |
| 60 por minuto | PREENCHER | PREENCHER |
| 42 por minuto, 70 por cento | PREENCHER | PREENCHER |

A linha sem limitador existe para demonstrar o problema que o limitador resolve. Espera-se 429 nela e zero nas demais.

---

## Custo do reprocessamento

| Cenário | Duração | Chamadas ao parceiro |
|---|---|---|
| Importação completa | PREENCHER | PREENCHER |
| Reprocessamento de PREENCHER registros em falha | PREENCHER | 0 |

A coluna de chamadas ao parceiro é o ponto. Reprocessar usa o payload bruto armazenado e não consome cota do parceiro.

---

## O que estes números não dizem

Não houve teste com mais de PREENCHER registros, então a linearidade da vazão não está demonstrada para volumes maiores.

Não houve teste com múltiplas instâncias da aplicação, cenário em que o limitador compartilhado via Redis passa a ser exercitado de verdade.

Não houve medição de uso de memória sob carga sustentada, então não há informação sobre acúmulo indevido de memória em execução longa.
