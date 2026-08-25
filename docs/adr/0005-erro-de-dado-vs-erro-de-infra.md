# ADR 0005 — Erro de dado rejeita, erro de infraestrutura retenta

**Situação:** aceita
**Data:** 2026-08-24

## Contexto

Durante a normalização, uma exceção pode ter duas origens completamente distintas. O payload do parceiro pode conter CPF com dígito verificador inválido, data inexistente como 31 de fevereiro, ou campo obrigatório vazio. Ou a chamada externa pode falhar por tempo esgotado, indisponibilidade momentânea ou erro 500 do parceiro.

Tratar as duas da mesma forma produz um dos dois desperdícios. Ou o registro com CPF inválido consome cinco tentativas com backoff exponencial para falhar exatamente igual nas cinco, ou a falha momentânea de rede descarta permanentemente um registro que estava correto.

## Decisão

Erro de validação de dado encerra o job com sucesso e grava o registro com situação `REJEITADO` e o motivo legível. Não consome tentativa.

Erro de infraestrutura relança a exceção e deixa a política de retry do BullMQ agir, com backoff exponencial e até cinco tentativas. Esgotadas as tentativas, o registro é gravado com situação `FALHA` e o payload bruto preservado.

A distinção é feita pelo tipo da exceção. `ZodError`, `DocumentoInvalidoError`, `DataInvalidaError` e `ValorMonetarioInvalidoError` são erros de dado. Qualquer outra exceção é tratada como de infraestrutura.

## Alternativas consideradas

**Retentar tudo.** Descartada porque multiplica por cinco o custo de processar registros defeituosos e atrasa a conclusão da execução sem nenhuma chance de sucesso.

**Rejeitar tudo.** Descartada porque uma indisponibilidade de trinta segundos do parceiro descartaria a carteira inteira, com perda de dado válido.

**Classificar por código de erro HTTP.** Descartada por ser insuficiente. O erro de dado acontece após a resposta bem-sucedida, durante o mapeamento, quando não há mais código HTTP envolvido.

## Consequências

**Positivas.** O tempo de execução não é consumido por tentativas inúteis. A separação entre `REJEITADO` e `FALHA` na consulta de registros permite distinguir de imediato problema de dado do parceiro, que exige contato com o parceiro, de problema de ambiente, que exige reprocessamento.

**Negativas.** A classificação depende de manter a lista de exceções de dado atualizada. Uma exceção de validação nova que não herde de um tipo conhecido será tratada como de infraestrutura e vai consumir cinco tentativas em silêncio. A mitigação seria uma classe base `ErroDeDado` e a regra de que todo validador herde dela, o que é o próximo passo de refatoração.

Registros com situação `REJEITADO` também podem ser reprocessados pelo endpoint de reprocessamento. Isso é intencional, porque um defeito de mapeamento corrigido em código torna reprocessável um registro antes rejeitado.
