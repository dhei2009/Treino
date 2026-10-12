# Shape Together 10.3.0 — central de organização pessoal

Esta entrega reformula a experiência principal do Shape Together sem remover o acompanhamento de treinos, o calendário, a progressão, as anotações, o Planejador ou as salas compartilhadas.

## O que mudou

- **Nova página inicial:** painel de vida pessoal com saudação, resumo de tarefas/metas/hábitos/treinos, atalhos para as seis áreas e lista das tarefas de hoje.
- **Nova área “Metas & hábitos”:** criação, edição, pausa, conclusão e exclusão de metas e projetos; percentuais de progresso; hábitos com frequência e marcação diária; resumo dos últimos sete dias.
- **Dados persistentes:** metas, projetos, hábitos e registros diários são salvos no Supabase por rotas autenticadas do Worker. Esses dados ficam pessoais e separados das salas.
- **Planejador ampliado:** visão por dia, semana, mês e ano. A visão anual mostra um resumo dos 12 meses e abre o calendário detalhado do mês escolhido. Calendários vazios continuam visíveis para facilitar o início do planejamento.
- **Navegação redesenhada:** rótulos mais claros, visual coerente entre áreas e barra móvel rolável para não esconder os atalhos em telas estreitas.
- **Preservação das funcionalidades anteriores:** os registros e gráficos de treino, as notas dos dias, o Planejador semanal/mensal, a alternância entre espaços e o fluxo de login continuam nas telas existentes.

## Como aplicar

1. Faça uma cópia de segurança do repositório e do Supabase. Use a branch `cloudflare-worker`.
2. Extraia este ZIP sobre a pasta raiz do projeto, mantendo os caminhos. **O ZIP contém somente arquivos alterados ou novos**; não apague arquivos que não estão nele.
3. Antes de publicar, abra o SQL Editor do Supabase e execute uma vez o conteúdo de `supabase/personal-organization.sql`. A migração cria as tabelas de metas/projetos/hábitos e os registros diários de hábitos. Não apaga nem converte dados de treino, tarefas existentes ou salas.
4. Publique os arquivos na branch `cloudflare-worker` e faça o deploy do Worker com os secrets já configurados. Não coloque chaves do Supabase no frontend.
5. Atualize o site sem cache. Entre em **Metas & hábitos**, crie uma meta, crie um projeto, crie um hábito e marque-o como feito hoje. Atualize a página para confirmar a persistência.
6. Teste também Início, Planejador diário/semanal/mensal/anual, Treinos/calendário, Progresso, Diário/Anotações, sala/convites, alternância de espaço, perfil, temas e logout.

## Arquivos nesta entrega

- `Public/index.html`
- `Public/js/app.js`
- `Public/css/style.css`
- `Public/js/modules/planner.js`
- `Public/js/modules/organizer.js` (novo)
- `server.js`
- `package.json`
- `supabase/personal-organization.sql` (novo)
- `README.md`

## Verificações locais

Rode `npm test` e `npm run check` após aplicar os arquivos no projeto completo e com as dependências instaladas. A verificação local não significa que o ZIP foi enviado ao GitHub, implantado no Cloudflare ou testado contra o banco online; essas etapas dependem da publicação no seu ambiente.
