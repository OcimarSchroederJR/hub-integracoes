# Contrato de normalização

Referência única de como cada campo de cada parceiro vira campo canônico. Quando um mapeamento diverge desta tabela, ou o código está errado ou a tabela está desatualizada, e uma das duas coisas precisa ser corrigida no mesmo commit.

---

## Regras que valem para todos os parceiros

**Documento.** Reduzido a dígitos e validado por dígito verificador de CPF ou CNPJ. Documento inválido rejeita o registro inteiro. Armazenado sem máscara, em `VarChar(14)`.

**Valor monetário.** Sempre inteiro em centavos. Nunca ponto flutuante em nenhum momento do caminho, incluindo etapas intermediárias. Conversão de decimal usa `Math.round` no final.

**Data.** Sempre convertida para UTC à meia-noite. Data sintaticamente válida mas inexistente, como 31 de fevereiro, rejeita o registro.

**Telefone.** Convertido para E.164 assumindo Brasil quando não houver código de país. Telefone inválido é descartado em silêncio e **não** rejeita o registro, porque um número ruim não invalida a dívida. Assimetria intencional em relação ao documento.

**E-mail.** Aparado e convertido para minúsculas. Não validado, pelo mesmo motivo do telefone.

**Nome.** Aparado. Vazio rejeita o registro.

**Situação.** Traduzida por tabela declarada no mapeador. Valor desconhecido resolve para `EM_ATRASO` e gera aviso no log, em vez de rejeitar. Recebida de forma repetida, indica vocabulário novo do parceiro e exige atualizar a tabela.

**Dias de atraso.** Nunca vem do parceiro. É sempre calculado internamente a partir do vencimento, para evitar divergência de critério entre parceiros.

---

## Parceiro Alfa

| Campo de origem | Campo canônico | Conversão |
|---|---|---|
| `externalId` | `identificadorExterno` | direta |
| `taxId` | `documento` | `Documento.criar` |
| `customerName` | `nome` | aparo |
| `contacts.phones[]` | `telefones[]` | `paraE164`, nulos descartados |
| `contacts.emails[]` | `emails[]` | minúsculas e aparo |
| `contracts[].contractNumber` | `numeroContrato` | direta |
| `contracts[].originalAmountCents` | `valorOriginal` | `Dinheiro.deCentavos` |
| `contracts[].currentAmountCents` | `valorAtualizado` | `Dinheiro.deCentavos` |
| `contracts[].dueDate` | `dataVencimento` | `deIso` |
| `contracts[].status` | `situacao` | tabela abaixo |
| não existe | `diasAtraso` | calculado |

Tradução de situação: `OVERDUE` para `EM_ATRASO`, `IN_NEGOTIATION` para `EM_NEGOCIACAO`, `SETTLED` para `QUITADA`, `CANCELED` para `CANCELADA`.

---

## Parceiro Beta

| Campo de origem | Campo canônico | Conversão |
|---|---|---|
| `CPF_CNPJ` mais `NUM_CONTRATO` | `identificadorExterno` | concatenação, ver nota |
| `CPF_CNPJ` | `documento` | `Documento.criar` |
| `NOME_CLIENTE` | `nome` | aparo, mantém maiúsculas da origem |
| `TELEFONE` | `telefones[]` | `paraE164` |
| `NUM_CONTRATO` | `numeroContrato` | direta |
| `VLR_ORIGINAL` | `valorOriginal` | `Dinheiro.deTextoBrasileiro` |
| `VLR_ATUALIZADO` | `valorAtualizado` | `Dinheiro.deTextoBrasileiro` |
| `DT_VENCIMENTO` | `dataVencimento` | `deBrasileiro` |
| `SITUACAO` | `situacao` | tabela abaixo |

Tradução de situação: `EM ATRASO` para `EM_ATRASO`, `EM NEGOCIACAO` para `EM_NEGOCIACAO`, `QUITADO` para `QUITADA`, `CANCELADO` para `CANCELADA`.

**Nota sobre o identificador externo.** O Beta não fornece identificador próprio de registro. A chave é derivada de documento e número de contrato. Isso significa que, se o parceiro reemitir o mesmo contrato para outro devedor, o hub tratará como registro distinto, o que é o comportamento desejado. Está documentado aqui porque é uma decisão de mapeamento, não uma limitação do formato.

**Nota sobre codificação.** O arquivo vem em latin-1. A decodificação acontece no adaptador, antes do parse do CSV. Ler como UTF-8 corrompe acentos em nomes de forma silenciosa, sem gerar erro, e o dado corrompido só é descoberto por inspeção visual.

---

## Teste de equivalência

O mesmo devedor enviado pelos dois parceiros deve produzir canônicos idênticos em `documento`, `valorOriginal`, `valorAtualizado` e `dataVencimento`. O teste `mapeadores produzem canônicos equivalentes` afirma exatamente isso e é a rede de proteção desta tabela. Alteração em qualquer mapeador que quebre a equivalência falha na integração contínua.
