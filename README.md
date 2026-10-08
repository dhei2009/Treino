# Shape Together — pacote consolidado

Este pacote contém somente os arquivos que precisam ser substituídos nesta correção.

## Arquivos

- `Public/index.html` — tela inicial limpa; Google é a única entrada visível; Socket.IO removido.
- `Public/js/app.js` — sessão online consolidada, `weekDates()` restaurado, login legado e Socket.IO removidos do frontend, sem apagar dados locais existentes.
- `Public/css/style.css` — versão consolidada com histórico diário, destaque verde dos últimos 7 dias e bloqueio visual durante o salvamento.
- `.gitignore` — evita subir secrets e arquivos locais.

## Importante

O banco Supabase **não deve ser apagado nem recriado**. Este pacote não contém `schema.sql` justamente para evitar qualquer substituição destrutiva.

O `server.js` também não é substituído neste pacote: as rotas legadas permanecem no backend por segurança de compatibilidade, mas não são mais apresentadas no frontend.

Depois da substituição, apague manualmente o arquivo `render.yaml` do repositório, pois o projeto atual usa Cloudflare Worker e não Render.
