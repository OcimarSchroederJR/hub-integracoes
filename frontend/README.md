# Frontend do Hub de Integrações

Painel web (React + Vite + TypeScript) para operar o [hub](../README.md) sem precisar de `curl`, do CLI ou do Swagger: login, disparar execução, acompanhar status com atualização automática, listar/reprocessar registros e ver sobreposições detectadas entre parceiros.

## Rodando

```bash
npm install
cp .env.example .env   # ajuste VITE_API_URL se a API não estiver em localhost:3000
npm run dev
```

Abre em `http://localhost:5173`. Precisa do hub rodando com CORS liberado (já é o padrão em `src/main.ts`) e do usuário admin criado pelo `npm run seed` do backend.

## Estrutura

- `src/api/` — cliente axios (injeta o Bearer token automaticamente) e os tipos que espelham as respostas do backend.
- `src/auth/` — contexto de autenticação (token em `localStorage`).
- `src/pages/` — uma página por rota: login, lista de execuções, detalhe de uma execução (registros + reprocessamento) e sobreposições.
- `src/components/` — layout com navegação, guarda de rota autenticada e o badge colorido de situação.

## Build de produção

```bash
npm run build   # tsc -b && vite build, gera frontend/dist
npm run preview # serve o build gerado, para conferir antes de publicar
```
