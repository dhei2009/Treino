# Shape Together

Versão atual do aplicativo preparada para hospedagem independente.

## Arquitetura real

- `server.js`: servidor Node.js/Express e API.
- `public/index.html`: interface atual do Shape Together.
- `public/favicon.svg` e `public/robots.txt`: arquivos públicos.
- `session-cookie.js`: sessão persistente e segura.
- `supabase/schema.sql`: estrutura do banco já usada pelo projeto.

O aplicativo depende do Supabase para autenticação/dados/Storage e usa Socket.IO para sincronização em tempo real.

## Executar

Configure as variáveis de ambiente do `.env.example` e execute:

```text
npm install
npm start
```

A porta é fornecida pela plataforma de hospedagem através de `PORT`.

## Deploy

Este projeto precisa de um servidor Node.js. GitHub Pages não executa o `server.js`; por isso o repositório pode ficar no GitHub, mas a hospedagem do aplicativo completo deve ser um Web Service, como Render.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` ou outros segredos reais no GitHub.
