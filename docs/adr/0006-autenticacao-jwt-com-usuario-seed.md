# ADR 0006 — Autenticação JWT com usuário único via seed

**Situação:** aceita
**Data:** 2026-08-30

## Contexto

A API do hub não tinha autenticação — qualquer um com acesso de rede podia disparar execuções, reprocessar registros ou ler a trilha de eventos. Isso era uma limitação de escopo consciente e documentada (o projeto foi desenhado como uma ferramenta interna, atrás de um gateway), mas deixa de ser aceitável assim que a API pode ficar exposta sem esse gateway na frente — inclusive no ambiente de demonstração deste portfólio.

O hub não é um produto multiusuário. Não existe caso de uso para um visitante se cadastrar sozinho; existe um operador (ou um punhado deles) que precisa logar para acionar as integrações e consultar o estado.

## Decisão

Autenticação via JWT (`Bearer` no header `Authorization`), com um `JwtAuthGuard` global (`APP_GUARD`) que bloqueia toda rota por padrão. Rotas que precisam ficar abertas — `/health` (monitoramento de infraestrutura) e `/metrics` (raspagem do Prometheus) — usam o decorator `@Public()` para escapar do guard explicitamente, em vez de uma lista de exclusão mantida à parte.

Não existe endpoint de cadastro. A tabela `Usuario` (email + hash bcrypt da senha) é populada por `prisma/seed.ts`, lendo `ADMIN_EMAIL`/`ADMIN_SENHA` do ambiente — o mesmo padrão que o seed já usava para os parceiros Alfa e Beta. `POST /auth/login` valida a senha e devolve um token assinado com `JWT_SECRET`, expirando em `JWT_EXPIRES_IN` (padrão 8h).

## Alternativas consideradas

**Sessão com cookie.** Descartada porque a API é consumida por `curl` e pelo CLI administrativo (`cli/`), nenhum dos dois mantém um cookie jar por padrão. Bearer token é o encaixe natural para um cliente não-browser.

**Cadastro público de usuários.** Descartado porque não existe cenário de negócio para isso aqui — o hub não tem múltiplos tenants nem um fluxo de convite. Um endpoint de cadastro aberto seria superfície de ataque sem benefício correspondente.

**Usuário fixo via variável de ambiente, sem tabela no banco.** Mais simples de implementar, mas não demonstra nada de autenticação de verdade (hash de senha, lookup no banco) e não permite trocar a senha sem redeploy. Descartada por entregar menos com uma economia pequena de código.

**Passport + `passport-jwt`.** O padrão mais comum em tutoriais NestJS, mas adiciona uma camada de indireção (estratégias, `AuthGuard('jwt')` do Passport) sobre algo que `@nestjs/jwt` sozinho já resolve com um guard de ~30 linhas. Descartada para manter a mesma filosofia do resto do projeto de não introduzir abstração além do que o problema exige.

## Consequências

**Positivas.** Toda rota de negócio passa a exigir autenticação por padrão — esquecer de proteger uma rota nova exigiria adicionar `@Public()` por engano, não o contrário, que é a direção mais segura de errar. O CLI (`cli/`) ganhou `login`/`logout` e persiste o token localmente, então continua utilizável sem mudança de fluxo para quem já loga uma vez.

**Negativas.** Não há refresh token: o token expira em `JWT_EXPIRES_IN` e o usuário precisa logar de novo, sem renovação silenciosa. Não há rate limiting no `POST /auth/login`, então nada impede tentativas de força bruta contra a senha do admin — aceitável para uma ferramenta interna de portfólio, não para uma API exposta publicamente sem mitigação adicional. Não há revogação de token antes da expiração (sem blocklist), então um token vazado continua válido até expirar. Essas três lacunas são aceitas conscientemente aqui pelo mesmo motivo que o projeto já deixou autenticação de fora antes: cada uma tem custo de implementação real e nenhuma delas é o que este projeto existe para demonstrar.

`/health` e `/metrics` continuam públicos de propósito — exigir token ali quebraria health checks de orquestrador e a raspagem do Prometheus, que não têm como carregar um Bearer token dinamicamente sem configuração adicional fora do escopo deste projeto.
