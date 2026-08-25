# ADR 0001 — Modelo canônico com adaptadores por parceiro

**Situação:** aceita
**Data:** 2026-08-24

## Contexto

Cada parceiro entrega os mesmos dados de cobrança em formato próprio, com codificação, formato numérico, formato de data e vocabulário de situação diferentes. O sistema precisa suportar a inclusão de parceiros novos sem que isso implique alterar regra de negócio já testada.

## Decisão

O domínio trabalha exclusivamente com um modelo canônico. Cada parceiro tem um adaptador que implementa a interface `ParceiroAdapter` com os métodos `coletarPagina`, `normalizar` e `enviarAtualizacao`. A resolução do adaptador é feita por um registro indexado pelo identificador do parceiro, com injeção de dependência.

Nenhum arquivo em `src/dominio` ou `src/integracao` importa qualquer coisa de `src/parceiros`. A dependência aponta apenas para dentro.

## Alternativas consideradas

**Um serviço de importação por parceiro, cada um com sua persistência.** Descartada porque duplica a regra de negócio de cálculo de atraso, de idempotência e de conclusão de execução em cada cópia. Com dois parceiros parece mais simples; com dez é impossível de manter consistente.

**Condicional por parceiro dentro do serviço de normalização.** Descartada porque cada parceiro novo obrigaria a editar e reimplantar um arquivo compartilhado, com risco de regressão em integrações que já funcionavam. É o caso clássico em que a alteração de um cliente derruba a integração de outro.

**Modelo canônico permissivo, com campos opcionais para acomodar todos os parceiros.** Descartada porque transfere a inconsistência para dentro do domínio. Se o canônico aceita valor tanto em centavos quanto em reais, toda regra de negócio precisa checar qual dos dois chegou.

## Consequências

**Positivas.** Um parceiro novo custa um diretório e uma linha de registro. A regra de negócio é testada uma vez e vale para todos. O teste de equivalência, que verifica se o mesmo devedor vindo de Alfa e de Beta produz canônicos idênticos, funciona como rede de proteção contra desvio de mapeamento.

**Negativas.** Existe uma camada de indireção a mais, que só se paga a partir do segundo parceiro. Particularidade que não cabe no canônico exige decidir entre estender o modelo, o que afeta todos, ou guardar no payload bruto, o que a torna inacessível ao domínio. Essa tensão é real e vai reaparecer.

## Como reverter

A interface `ParceiroAdapter` é o único ponto de acoplamento. Abandonar o padrão significa mover a lógica de cada mapeador para dentro do processador de normalização e remover o registro de adaptadores. É reversível em algumas horas, mas cada parceiro adicionado aumenta esse custo.
