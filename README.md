# Shape Together 10.4.2 — polimento visual e correções de interação

Pacote incremental para aplicar sobre o projeto existente. Mantém os módulos, recursos e dados; não modifica banco de dados e não exige nova migração SQL.

## O que este pacote ajusta

- Usa a marca enviada para o favicon, a tela inicial, o acesso e a navegação lateral, substituindo o monograma antigo.
- Amplia a janela “Novidades do aplicativo” para ocupar melhor a tela, mantém os destaques da 10.4.2 e 10.4.0 e limita a rolagem à lista de novidades. O botão continua como **Continuar**.
- Retorna à navegação móvel com abas individuais para Início, Planejar, Metas, Treino, Progresso, Diário e Espaços, numa faixa horizontal rolável; não usa grupos com subabas.
- Faz as cores de apoio e os indicadores do painel acompanharem a cor selecionada, inclusive ao retornar ao tom padrão. Mantém oito cores predefinidas distintas e um seletor personalizado com prévia em tempo real; cores semânticas dos estados de treino permanecem estáveis.
- Eleva a folha de registro diário sobre a barra de navegação, fixa as ações no rodapé e esconde a barra inferior enquanto o registro estiver aberto para não cobrir **Salvar**.
- Exibe indicador de carregamento ao alternar entre espaço pessoal e sala.
- Mantém o botão da Central de Ajuda redondo e discreto, com uma animação leve.

## Arquivos incluídos

- `Public/index.html`
- `Public/js/app.js`
- `Public/css/style.css`
- `Public/css/redesign.css`
- `Public/brand-mark.png` (ícone enviado, recortado ao redor do emblema para ficar legível em tamanhos pequenos)
- `README.md`

## Instalação

1. Faça uma cópia de segurança do projeto atual.
2. Extraia o ZIP na raiz do repositório, mantendo os caminhos. Substitua os arquivos correspondentes e adicione `Public/brand-mark.png`. O pacote inclui `Public/css/style.css` porque ajusta cores de componentes antigos; substitua esse arquivo também. Não apague os módulos ou outros arquivos existentes.
3. Publique os arquivos na branch `cloudflare-worker` e faça o deploy do Cloudflare Worker.
4. Faça uma recarga completa no navegador depois do deploy para carregar o novo identificador de CSS, JavaScript e marca.

Não exige SQL novo. Este pacote não foi publicado no GitHub nem implantado no Cloudflare durante a preparação.
