# Shape Together 10.4.2 — Polimento da interface

Pacote incremental com ajustes pontuais de interface. Não substitui o projeto inteiro, não modifica o banco de dados e não exige nova migração SQL.

## O que mudou

- **Novidades do aplicativo:** usa o símbolo atual do Shape Together; remove a identificação visível do build; destaca a versão 10.4.2 e cinco mudanças importantes de 10.4.2/10.4.0; torna a lista de novidades rolável de forma independente e mantém o botão **Continuar** acessível.
- **Navegação em telas pequenas:** a barra inferior mostra somente quatro áreas principais — Início, Organizar, Treino e Espaços — e a barra contextual exibe as subáreas correspondentes. Organizar reúne Planejador e Metas; Treino reúne Treinos e Progresso; Espaços reúne Salas e Diário.
- **Identidade visual:** recupera acentos coloridos com equilíbrio, ícones SVG coerentes por área, transições sutis e respeito à preferência do sistema por movimento reduzido.
- **Central de ajuda:** botão circular cinza e discreto, com ícone SVG e sem destaque laranja intenso.
- **Marca:** novo favicon SVG alinhado à identidade visual atual e referências de cache sincronizadas.

## Arquivos incluídos

- `Public/index.html`
- `Public/js/app.js`
- `Public/css/redesign.css`
- `Public/favicon.svg`
- `README.md`

## Instalação

1. Faça uma cópia de segurança do projeto atual.
2. Extraia este ZIP **na raiz do repositório** do Shape Together, mantendo os caminhos. Substitua os quatro arquivos existentes pelos arquivos do pacote; não apague os demais módulos, folhas de estilo ou arquivos estáticos.
3. Envie as mudanças para a branch `cloudflare-worker` do GitHub junto com os arquivos existentes, e publique um novo deploy do Cloudflare Worker.
4. Abra o site e faça uma recarga completa/limpe o cache para buscar os novos identificadores de CSS e JavaScript.

**Não é necessário executar SQL.** Este pacote não inclui alterações no backend ou na estrutura do Supabase.

## Verificações locais

A versão foi verificada com os testes e comandos de sintaxe já existentes no projeto, além de validação das referências estáticas, CSS, favicon SVG e estrutura de navegação. O pacote não foi enviado ao GitHub nem implantado no Cloudflare durante esta preparação.
