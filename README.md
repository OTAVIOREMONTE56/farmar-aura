# FARMAR AURA

Jogo web 3D de memória e dança, em JavaScript, Vite e Three.js. Na tela inicial, escolha **1 JOGADOR** ou **2 JOGADORES → LOCAL / ONLINE**.

## Executar

Com Node.js 22.12 ou superior:

    npm install
    npm run dev

Nesta pasta também existe um Node.js isolado em .tools. Você pode clicar duas vezes em abrir-jogo.cmd ou configurar o PATH somente no seu terminal PowerShell:

    $runtime = (Get-ChildItem .tools -Directory -Filter "node-*-win-x64" | Select-Object -First 1).FullName
    $env:Path = "$runtime;$env:Path"
    npm.cmd run dev

Abra o endereço informado pelo Vite, com caminho /farmar-aura/. Para encerrar, pressione Ctrl+C.

    npm test
    npm run build
    npm run preview

## 1 jogador

Memorize as danças demonstradas pelo sapo e repita usando Q/W/E/R/T/Y ou os seis botões de toque. Cada nível preserva a sequência e adiciona um movimento. Um erro consome uma das três vidas e demonstra novamente a mesma sequência. Entradas ficam bloqueadas durante demonstrações e animações. Não há limite de tempo para responder.

A pontuação permanece: +25 Aura por movimento correto, +100 × nível por sequência completa e +50 extras se não houve erro naquele nível. Combo conta sequências completas sem perder vida, com mínimo x1. Recordes de Aura e sequência usam armazenamento local. Esse modo funciona sem configurar o Supabase.

## 2 jogadores online

Cada aparelho mostra seu próprio personagem 3D, vidas, Aura, combo, progresso e seis botões. O adversário aparece de forma compacta no topo. O modo online usa uma cena por aparelho; o modo local permanece disponível no menu.

Crie uma sala para gerar um código de seis caracteres. No outro aparelho, entre pelo código. A partida começa quando os dois personagens estiverem carregados. São cinco rodadas, com a mesma sequência para ambos e pontuação independente. Uma revanche exige que os dois toquem JOGAR NOVAMENTE; SAIR DA SALA encerra a sala para ambos.

**Configuração completa:** [supabase/README.md](supabase/README.md).

**SQL para execução manual:** [supabase/multiplayer.sql](supabase/multiplayer.sql).

Antes de usar o online, copie .env.example para .env.local e preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY com a URL e chave pública do seu projeto. Reinicie o servidor ou gere o build novamente. Nenhum SQL é executado remotamente pelo código ou pelos testes.

Para jogar em redes diferentes, os aparelhos precisam acessar uma versão atualizada do jogo em uma URL pública HTTPS. Supabase sincroniza os aparelhos, mas não publica o frontend. Nenhuma publicação no GitHub foi feita nesta implementação.

## Personagem, animações e música

O modelo existente fica em public/models/character/frog.glb. Se estiver indisponível, o carregador mantém o sapo procedural. A hierarquia do modelo e os clips existentes não foram alterados pelo multiplayer.

O sistema de personagem mantém load, registerAnimation, registerAnimationAlias, playAnimation, stopAnimation, update e dispose. As seis danças continuam sendo passinho, giro, moonwalk, pose-sigma, dab e breakdance, com retorno ao idle e enquadramento pelo CameraDirector. A música Arcade Groove usa o gerenciamento existente de volume, silêncio e ativação por gesto do usuário.

## Organização

- src/core: cena, renderizador, câmera e ciclo de renderização; createApp para solo e createOnlineApp para online.
- src/game: regras do solo e implementação anterior do multiplayer local, preservada como referência e com seus testes.
- src/online: cliente Supabase, sincronização e timeline das demonstrações.
- src/ui: lobby, HUD, identidade visual dos movimentos e controles de teclado/toque.
- src/entities/character: carregamento do modelo, sapo procedural e animações.
- src/world e src/audio: cenário, iluminação e música.
- supabase: SQL, policies e instruções de configuração.
- tests: testes de solo, modo local, mobile, cliente online e SQL local via PGlite.

As regras antigas de tempo em src/game/createGame.js e src/systems/auraRound.js continuam desconectadas do modo principal e preservadas como referência para um futuro SPEED AURA.

Os testes verificam o SQL em PostgreSQL local, sem credenciais e sem conexão remota. O transporte real de Supabase Realtime ainda deve ser validado em dois aparelhos depois da configuração do projeto.

## Publicação no GitHub Pages

O workflow .github/workflows/deploy.yml testa e gera o build antes de publicar. VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão configuradas no passo Build com os valores públicos deste projeto; variáveis de repositório com esses nomes podem substituí-los. .env.local permanece ignorado. Nunca configure service_role, senha de banco ou chave secreta no frontend.

Endereço público: https://otavioremonte56.github.io/farmar-aura/
