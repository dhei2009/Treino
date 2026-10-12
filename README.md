# Shape Together 10.2.0 — base do Planejador

Este pacote prepara a primeira etapa da expansão do Shape Together para uma plataforma de planejamento pessoal e compartilhado. Ele inclui os ajustes acumulados da versão 10.1.2 e o novo Planejador semanal/mensal. O ZIP de entrega contém somente arquivos alterados ou adicionados em relação ao repositório original recebido; os demais arquivos originais devem permanecer no lugar.

## O que entra nesta etapa

- Novo módulo **Planejador** com visualização semanal e mensal.
- Criação, listagem, conclusão/reabertura e exclusão de tarefas.
- Data opcional, detalhes, prioridade e categoria.
- Tarefas pessoais privadas e tarefas compartilhadas no espaço de uma sala.
- Permissões para que apenas o criador ou um administrador/proprietário da sala altere ou exclua uma tarefa compartilhada.
- Validação de dados no backend, consultas limitadas a períodos razoáveis e cabeçalhos de não-cache nas rotas da API.
- Migração aditiva do banco, sem converter tarefas em registros de treino.
- Referências CSS/JS versionadas na build `10.2.0 / 2026.10.12-planner-foundation-1`.
- Correções da base 10.1.2: separação de registros pessoais e por sala, suporte à descoberta de salas públicas, preservação de papéis e melhorias de integridade descritas abaixo.

## Como aplicar com segurança

1. Faça backup do Supabase e confirme que está trabalhando na branch `cloudflare-worker`.
2. Extraia o ZIP e substitua/crie os arquivos nos caminhos exatos. Não apague os outros arquivos que não aparecem no pacote.
3. No Supabase SQL Editor, confira as migrações já aplicadas. Se ainda não estiverem no banco, execute na ordem apropriada: `supabase/groups-visibility.sql`, `supabase/workspace-mode.sql`, `supabase/group-day-records.sql` e, por último, `supabase/planner-tasks.sql`. Não execute novamente migrações antigas sem conferir o estado do banco, especialmente `group-day-records.sql`, que copia registros históricos para as salas participantes.
4. Verifique se os secrets atuais do Cloudflare continuam configurados. Nenhuma chave administrativa deve ser colocada no frontend.
5. Rode `npm test` e `npm run check` em um ambiente com as dependências do projeto instaladas.
6. Envie os arquivos ao GitHub na branch `cloudflare-worker`, publique o Worker e faça recarga forçada no navegador.
7. Valide manualmente em desktop e celular: login, Início, Planejador, Calendário, radar/gráficos, anotações, alternância pessoal/sala, convite, exclusão de tarefa e permissões entre dois participantes. Também confirme a tela de novidades com a versão `10.2.0`.

## Migração nova: `supabase/planner-tasks.sql`

A migração é **aditiva**: cria a tabela `planner_tasks`, índices e trigger; não altera nem apaga `day_records` ou `group_day_records`. Ativa RLS e bloqueia acesso direto de `anon`/`authenticated`; a aplicação acessa a tabela exclusivamente por rotas autenticadas do Worker. Tarefas pessoais ficam separadas das tarefas ligadas a uma sala.

Para instalações novas, `supabase/schema.sql` também contém a estrutura da tabela. Para o banco que já existe, use `planner-tasks.sql`; não recrie o banco e não execute `schema.sql` sobre um banco em uso apenas para instalar este recurso.

## Limites intencionais da primeira etapa

Ainda não fazem parte desta entrega: recorrência automática, metas e marcos, atribuição de tarefas a participantes específicos, notificações, planejamento anual assistido, exportação e sugestões com IA. Essas partes estão descritas em `docs/PLANO-ARQUITETURA.md` e devem ser implementadas em fases com testes de regressão.

## O que foi verificado no pacote

A verificação local cobre sintaxe JavaScript, testes unitários das validações e os testes de sessão já existentes. Não significa que o banco foi migrado, nem que o pacote tenha sido enviado ao GitHub, publicado no Cloudflare ou validado visualmente no site online. Essas etapas precisam ser executadas e verificadas depois da aplicação do ZIP.
