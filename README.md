# Farmar Aura

Base independente de jogo web 3D em JavaScript, Vite e Three.js. A base inclui câmera, iluminação, chão e sistema de personagem com sapo procedural temporário.

## Executar

Foi incluído um Node.js isolado em `.tools`, sem alterar a instalação global. Você pode clicar duas vezes em `abrir-jogo.cmd`.

Para usar `npm run dev` no PowerShell desta pasta, primeiro configure o PATH apenas nesse terminal:

```powershell
$runtime = (Get-ChildItem .tools -Directory -Filter "node-*-win-x64" | Select-Object -First 1).FullName
$env:Path = "$runtime;$env:Path"
npm.cmd run dev
```

Com Node.js 22.12 ou superior e npm já disponíveis:

```powershell
npm install
npm run dev
```

Abra o endereço informado pelo Vite (normalmente http://127.0.0.1:5173). Para encerrar, pressione Ctrl+C no terminal.

```powershell
npm run build
npm run preview
```

## Organização

- `src/core`: renderizador, câmera, ciclo de renderização e redimensionamento.
- `src/world`: cena, iluminação e chão.
- `src/entities`: futuros personagens e objetos.
- `src/systems`: futuras animações e regras de gameplay.
- `src/ui`: futuro HUD.
- `src/audio`: futuro gerenciamento de áudio.
- `public/assets/models`, `animations`, `textures`, `audio`: futuros recursos estáticos.

Os diretórios de funcionalidades futuras permanecem reservados. Nenhum gameplay, HUD ou áudio foi implementado.

## Personagem 3D

Coloque o GLB em `public/models/character/frog.glb` e recarregue a página. Até lá, um sapo humanoide verde articulado, vestido com jaqueta laranja, camiseta clara, calça cargo escura, tênis, óculos e corrente dourada é usado como personagem temporário. Sua geometria e animações estão separadas do carregador GLB.

O modelo deve estar em pé, com Y para cima e frente em +Z. O sistema normaliza a altura para 1,8 unidades e posiciona os pés no chão. Se a frente for -Z, configure `facingRotation: Math.PI` na criação do personagem em `src/core/createApp.js`. A câmera enquadra o modelo ao carregar e ao redimensionar a janela.

`src/entities/character/createCharacter.js` expõe `load`, `registerAnimation`, `registerAnimationAlias`, `playAnimation`, `stopAnimation`, `update` e `dispose`. Clips do GLB são registrados pelo nome; `idle` inicia automaticamente se existir. Os nomes planejados são `idle`, `passinho`, `giro`, `moonwalk`, `pose-sigma`, `dab` e `breakdance`. O sapo procedural inclui seus próprios clips Idle e Passinho; ao carregar o GLB, esses clips são descartados e substituídos pelas animações do arquivo.

Exemplo de integração futura: `character.registerAnimationAlias("passinho", "Dance"); character.playAnimation("passinho");`. Animações externas ficam em `public/animations/` e precisarão de um rig compatível.

## Teste do sapo procedural

Use o botão PASSINHO ou a tecla Q para executar uma dança de aproximadamente um segundo. O personagem retorna suavemente ao Idle. O botão IDLE também permite interromper a dança suavemente. Os controles são temporários e não implementam pontuação ou gameplay.

- `createProceduralFrog.js`: geometrias arredondadas, roupa, acessórios e pivôs.
- `frogAnimations.js`: clips gerados por código para os membros, joelhos, cotovelos, tronco e cabeça.
- `createAnimationControls.js`: botões de teste e tecla Q.

Execute `node scripts/check-character.mjs` para verificar o sistema e `node scripts/check-controls.mjs` para conferir os eventos dos controles.

## Modo principal: Memória + Dança

A partida começa com duas danças demonstradas pelo sapo. Repita a ordem usando Q/W/E/R/T/Y ou toque; cada nível preserva a sequência e adiciona um movimento. Entradas ficam bloqueadas durante demonstrações e animações em andamento. Um erro consome uma das três vidas e demonstra novamente a mesma sequência. Não há limite de tempo para responder.

Pontuação: 25 Aura por movimento correto, 100 × nível por sequência completa e 50 extras se não houve erro naquele nível. Combo conta sequências completas sem perder vida (mínimo x1). Sequência máxima representa o maior comprimento alcançado, inclusive a sequência que encerrou a partida. Recordes usam armazenamento local; o recorde anterior de Aura é preservado.

As regras antigas de tempo em src/game/createGame.js e src/systems/auraRound.js estão desconectadas do modo principal e reservadas como referência para um futuro SPEED AURA.

Testes das regras: node --test tests/memoryGame.test.js
