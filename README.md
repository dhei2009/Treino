# Shape Together 10.4.2 — recuperação e auditoria

Este pacote corrige a inicialização do aplicativo e melhora o diagnóstico de falhas de banco/servidor. Ele é incremental: extraia sobre a raiz do repositório existente, preserve os demais arquivos e não apague CSS, módulos ou dados.

## O que foi corrigido

- A tela de falha não chama mais todo erro de “manutenção”; preserva a causa útil e oferece **Tentar novamente**.
- Uma promessa assíncrona rejeitada isoladamente não oculta mais toda a aplicação. Ela é registrada no console para diagnóstico.
- A inicialização consulta `/api/health` em caso de erro e tenta distinguir configuração incompleta, timeout/conexão, bucket de fotos ausente e migrações de banco pendentes.
- O servidor traduz falhas conhecidas de PostgREST/Postgres em instruções seguras e específicas, sem expor SQL ou credenciais.
- O acesso a `localStorage` passou a ser tolerante a navegadores que bloqueiam o armazenamento local, impedindo que uma preferência visual derrube o app inteiro.
- Os identificadores da versão e das URLs de CSS/JavaScript foram alinhados para evitar mistura entre arquivos em cache.
- Os botões de cores predefinidas no seletor de aparência agora são HTML válido e possuem os valores de cor esperados.
- Os testes existentes foram ampliados com testes de classificação de erros de esquema.

## Arquivos incluídos

- `Public/index.html`
- `Public/js/app.js`
- `server.js`
- `package.json`
- `schema-error.js`
- `schema-error.test.js`
- `supabase/group-day-records.sql`
- `README.md`

Os arquivos fora dessa lista devem permanecer na pasta do projeto. O SQL está incluído por ser a migração correspondente ao erro já observado: `Could not find the table 'public.group_day_records' in the schema cache`.

## Instalação recomendada

1. Baixe e extraia este ZIP na raiz do repositório do Shape Together, mantendo os caminhos. Substitua os arquivos com o mesmo nome e adicione os dois arquivos novos (`schema-error.js` e `schema-error.test.js`).
2. No Supabase, abra **SQL Editor** e execute o conteúdo completo de `supabase/group-day-records.sql`. A migração é aditiva e idempotente: cria/configura a tabela de registros das salas e copia registros pessoais para as salas correspondentes sem apagar os registros pessoais. Se você já executou essa migração e ela terminou sem erros, não é necessário repeti-la.
3. Faça commit/push dos arquivos na branch `cloudflare-worker` e publique um novo deploy do Cloudflare Worker. Mantenha os secrets existentes; nunca copie chaves secretas para o código ou para mensagens públicas.
4. Abra `https://treino.dheisson-sousa.workers.dev/api/health`. A resposta contém apenas indicadores de configuração e tabelas. Se algum valor em `tables` for `false`, a interface agora informa a migração provável. Se algum campo em `config` for `false`, corrija os bindings correspondentes no Cloudflare.
5. Acesse o aplicativo e faça uma recarga completa/limpe o cache do site. Teste o login, o calendário pessoal, uma sala, o Planejador, metas/hábitos e o seletor de aparência.

## Verificações locais

No ambiente de desenvolvimento, execute:

```sh
npm test
npm run check
```

Nesta preparação, os testes automatizados passaram: **12 testes, 0 falhas**, e todos os arquivos JavaScript verificados passaram pelo parser do Node.

## Importante

Este pacote ainda não foi publicado no GitHub nem implantado no Cloudflare. A aplicação online só receberá a correção depois que os arquivos forem enviados e o Worker for publicado. Se o erro continuar após a publicação e a migração, consulte os logs do Worker no Cloudflare; não compartilhe as chaves do Supabase.
