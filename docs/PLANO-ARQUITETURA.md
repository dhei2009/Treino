# Shape Together — arquitetura de expansão

**Estado deste documento:** plano vivo da evolução modular. A versão 10.2.0 implementa a primeira fatia vertical do Planejador (tarefas semanais/mensais) e não pretende completar todas as fases do produto em um único deploy.

## 1. Objetivo de produto

Transformar o Shape Together em um espaço para planejar, executar e acompanhar objetivos pessoais ou compartilhados. Treinos permanecem um módulo de primeira classe, mas deixam de ser o único tipo de atividade suportado.

Princípio central: planejamento não é execução. Uma tarefa planejada não deve ser considerada concluída sem um registro explícito; a ausência de dados não deve ser tratada como inatividade.

## 2. Navegação e módulos

- **Visão geral:** resumo do dia, próximas tarefas e indicadores úteis.
- **Planejador:** visões semanal e mensal, tarefas com data opcional, prioridade e categoria.
- **Calendário/treinos:** preservar o registro diário e as validações específicas do desafio.
- **Projetos:** agrupar tarefas e entregas em etapas.
- **Objetivos:** metas com prazo, progresso mensurável e marcos.
- **Hábitos:** frequências e entradas de realização, sem confundir dias sem registro com falha.
- **Progresso:** combinar relatórios de tarefas e hábitos com gráficos de treino, mantendo métricas separadas e semanticamente explícitas.
- **Salas e colaboração:** contexto compartilhado opcional, permissões por participante e atualizações em tempo real.
- **Configurações e conta:** manter perfil, tema, cores, espaço padrão e exclusão de conta.

A interface deve permitir usar tarefas e calendário sem exigir a configuração de objetivos, hábitos ou salas.

## 3. Arquitetura técnica

### Frontend

`Public/index.html` continua sendo o ponto de entrada; `Public/js/app.js` segue responsável pela sessão, navegação e módulos existentes. Novos recursos ficam isolados em `Public/js/modules/` sempre que isso for viável, usando eventos de navegação documentados e APIs autenticadas. O CSS novo usa os tokens globais de tema (`--panel`, `--text`, `--line`, `--accent`) e precisa respeitar responsividade e `prefers-reduced-motion`.

### Backend

As regras de negócio e validações são autoritativas no Cloudflare Worker. O frontend nunca recebe a chave administrativa do Supabase. Rotas novas devem usar `requireAuth`, respostas genéricas em erros inesperados, validação allowlist dos campos, limites de consulta e `Cache-Control: no-store`.

### Persistência

O Supabase PostgreSQL continua como fonte de verdade. Mudanças chegam por migrações aditivas, com índices e constraints. Tabelas com dados pessoais não devem ser compartilhadas apenas por ocultação visual; todo escopo deve ser validado no backend. O serviço usa a chave secreta exclusivamente do lado do Worker.

### Separação de espaços

- Pessoal: `workspace_group_id IS NULL`, filtrado pelo dono da tarefa.
- Sala: `workspace_group_id` referencia uma sala e a leitura requer associação a essa sala.
- Em tarefas de sala, apenas o autor e membros com papel `admin`/`owner` podem editar ou excluir no MVP. A atribuição individual a outros participantes será adicionada depois.
- A exclusão de uma conta elimina tarefas pessoais e desvincula o autor das tarefas de salas sobreviventes, para preservar o trabalho compartilhado.
- Registros de treino (`day_records` e `group_day_records`) não são convertidos para tarefas.

## 4. Modelo de dados por etapa

### Implementado na 10.2.0

`planner_tasks`: `id`, `owner_id`, `workspace_group_id`, `title`, `details`, `due_date`, `priority`, `status`, `category`, `created_at`, `updated_at`. Categorias atuais: geral, pessoal, estudos, trabalho, treino e projeto. Status atual: aberta, concluída ou cancelada (a interface usa aberta/concluída). Prioridade: baixa, normal ou alta.

### Proposto para fases futuras

- `projects`: título, descrição, dono/escopo, status, prazo e timestamps.
- `project_members`: projeto, usuário e papel, caso projetos possam ser compartilhados de forma independente da sala.
- `goals`: título, descrição, métrica, unidade, valor inicial/alvo, prazo, dono/escopo e status.
- `goal_milestones`: marcos ordenados vinculados a uma meta.
- `habits`: definição do hábito, frequência e fuso horário.
- `habit_entries`: execução por data, com unicidade e regras de atraso explícitas.
- `planner_settings`: início da semana, preferências de visualização e lembretes.
- Futuramente, `task_assignments` para atribuição de atividades compartilhadas.

Os nomes e colunas propostos precisam ser revisados contra o schema Supabase real antes de suas migrações; não são instrução para executar SQL agora.

## 5. Fases e critérios de conclusão

### Fase A — proteção da base + Planejador inicial

Incluída na versão 10.2.0: build versionada, módulo separado, tarefas semanais/mensais, API autenticada, validação e migração aditiva. Antes do deploy, validar todas as funcionalidades antigas e testar com duas contas em uma sala compartilhada.

**Critério:** nenhuma regressão em autenticação, registros de treino, calendário, gráficos, temas, perfil, navegação por espaços e exclusão de conta; testes de dados pessoais e permissões de sala aprovados.

### Fase B — recorrência, projetos e objetivos

Adicionar regras de recorrência com geração de ocorrências estável (não criar cópias duplicadas a cada abertura); projetos com tarefas vinculadas; metas e marcos. Decidir regras de reagendamento e fuso horário antes de implementação. Testar data de verão/fuso, tarefas sem data, concluídas, canceladas e alterações concorrentes.

### Fase C — hábitos e relatórios

Criar hábitos com frequência configurável, registros explícitos por dia e taxa de consistência calculada apenas sobre as ocorrências esperadas. Criar relatório semanal/mensal separado do radar de treinos, com exportação CSV/JSON e distinção entre tarefa planejada, realizada e sem registro.

### Fase D — colaboração completa

Adicionar atribuição de tarefas, funções e permissões granulares, transferências, atualizações em tempo real e histórico de alterações. Testar revogação de membro, remoção de proprietário, conta excluída, reenvios de rede e edições concorrentes. O escopo de dados de sala precisa ser validado no servidor em todas as rotas.

### Fase E — automação e PWA

Lembretes opt-in, cache offline de leitura, fila de sincronização com resolução de conflito, exportação/backup mais completo e sugestões inteligentes opcionais. A IA não deve mover ou apagar conteúdo sem confirmação explícita.

## 6. Plano de testes e rollout

1. Testes unitários para validadores e funções de datas.
2. Testes de API com dados isolados: sem sessão, sessão inválida, tarefa própria, tarefa de outro usuário, não membro da sala, membro comum, admin e proprietário.
3. Testes de banco para constraints, cascatas e políticas RLS.
4. Teste de regressão manual guiado na interface desktop e celular.
5. Aplicar migrações aditivas no Supabase de teste e validar queries antes de produção.
6. Publicar arquivos versionados, observar saúde/API e verificar a build retornada no site online.
7. Manter ZIP e versão anteriores disponíveis para rollback; rollback de código deve ser compatível com a migração aditiva já aplicada.

## 7. Riscos conhecidos e decisões pendentes

- A primeira etapa não implementa recorrência, projetos, objetivos, hábitos ou lembretes; a estrutura está planejada, não simulada.
- A remoção do autor de uma tarefa compartilhada deixa `owner_id` nulo; proprietários/administradores remanescentes continuam podendo gerenciar a tarefa. A transferência explícita de autoria pode ser adicionada na fase D.
- O endpoint limita a consulta a 500 tarefas e janelas de até 371 dias; paginação e arquivamento devem ser avaliados conforme o uso real.
- A checagem estática de sintaxe não substitui teste visual real, integração com Supabase nem confirmação do deploy.
