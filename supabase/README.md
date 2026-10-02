# Configurar 2 JOGADORES ONLINE

O código está preparado; nenhuma credencial foi inventada e nenhum SQL foi executado remotamente.

## Etapas no Supabase

1. Crie ou escolha um projeto no painel Supabase.
2. Abra **Authentication → Sign In / Providers → Anonymous Sign-Ins** e habilite **Allow anonymous sign-ins**. O jogo cria uma identidade por navegador, sem pedir e-mail. Esses usuários usam o papel authenticated e estão sujeitos às policies.
3. Abra **SQL Editor → New query**, copie todo o arquivo **supabase/multiplayer.sql** e execute você mesmo. O script usa uma transação e pode ser executado novamente. Ele cria:
   - public.aura_rooms: código, participantes, partida, sequência, vidas, Aura, combos e progresso;
   - policy aura_members_read: somente os dois participantes podem ler a sala;
   - public.aura_room_action: operações autenticadas e validadas, com bloqueio de linha para evitar corridas;
   - helpers no schema privado aura_private, sem acesso pelos usuários;
   - inclusão de aura_rooms na publicação supabase_realtime.
4. Confira em **Database → Publications → supabase_realtime** que **public.aura_rooms** está habilitada. Dependendo da versão do painel, a opção aparece como Realtime no Table Editor. O script já faz isso. Não é necessário liberar escrita direta na tabela, criar policies abertas ou habilitar Broadcast.
5. Obtenha a **Project URL** em **Connect** (ou Settings → Data API) e a chave **anon / public** em **Settings → API Keys → Legacy keys**. Uma **publishable key** também funciona. Não use service_role nem secret key.
6. **É nesta etapa que você fornece URL e chave:** copie .env.example para **.env.local**, na raiz do projeto, e preencha:

   VITE_SUPABASE_URL=<URL do seu projeto>
   VITE_SUPABASE_PUBLISHABLE_KEY=<sua chave pública anon ou publishable>

7. Reinicie npm run dev. Se usar os arquivos de produção, execute npm run build novamente: o Vite incorpora essas variáveis no build. A chave pública é destinada ao navegador; as permissões são controladas por autenticação, RLS e RPC. .env.local está ignorado pelo Git.
8. Teste em dois aparelhos: no primeiro, **2 JOGADORES ONLINE → CRIAR SALA**; no segundo, **ENTRAR EM SALA**, digite os seis caracteres e toque **ENTRAR**. A partida começa após os dois sapos carregarem. Teste movimento correto, erro, fim de rodada, resultado, votação de revanche e saída.

Documentação oficial: https://supabase.com/docs/guides/auth/auth-anonymous e https://supabase.com/docs/guides/realtime/postgres-changes.

## Acesso entre aparelhos e redes diferentes

Todos os aparelhos devem abrir uma versão do jogo que contenha este código e a mesma configuração Supabase. Cada um mantém sua identidade no armazenamento do próprio navegador.

Para teste na mesma rede: npm run dev -- --host 0.0.0.0; no celular, abra o IP do PC com porta 5173 e caminho /farmar-aura/. O endereço localhost sempre se refere ao próprio aparelho.

Para casas/redes diferentes, será necessário disponibilizar este build em uma URL pública HTTPS, ou usar um túnel HTTPS para o servidor de desenvolvimento. Configurar o Supabase resolve a comunicação entre aparelhos, mas não torna o endereço local do PC público. Nenhuma publicação ou alteração no GitHub foi feita nesta tarefa. Uma versão já publicada do jogo continuará com seu código anterior até uma futura publicação autorizada.

Para testar dois jogadores no mesmo computador, use navegadores diferentes ou perfis independentes. Duas abas do mesmo perfil compartilham a identidade Supabase e não representam dois jogadores.

## Regras e sincronização

- Uma cena, um personagem e seis botões por aparelho; sem tela dividida.
- Mesma sequência crescente para os dois: comprimentos 2, 3, 4, 5 e 6.
- Três vidas por jogador para a partida inteira. Um erro consome uma vida, zera o progresso e combo desse jogador e demonstra novamente a mesma sequência somente para ele.
- +25 Aura por movimento certo; +100 × rodada por sequência; +50 se a rodada foi sem erro; +50 para quem terminar primeiro. O servidor determina o primeiro pela chegada do movimento final, com a janela de 30 ms já usada no modo local. A latência da rede pode influenciar esse bônus.
- Jogador sem vidas acompanha o restante da partida. São mantidas cinco rodadas mesmo quando ambos ficam sem vidas.
- Fim de rodada é liberado apenas com os dois completos ou eliminados; ambos veem o resultado. A próxima rodada usa o mesmo horário do servidor.
- Revanche começa somente após os dois tocarem JOGAR NOVAMENTE; todos os valores são reiniciados.
- SAIR DA SALA encerra a sala para ambos. Perda breve de conexão tenta recuperar o estado; sem atualização por 7 segundos os controles bloqueiam. Ausência de um participante por mais de 90 segundos encerra a sala quando o outro sincroniza. Recarregar a página retorna ao menu; se necessário, encerre a sala anterior e crie outra.
- Salas expiram após 24 horas. Linhas antigas permanecem para inspeção; uma limpeza agendada pode ser configurada futuramente pelo administrador.
- Realtime entrega mudanças por sala. Uma leitura RPC a cada 2 segundos serve como recuperação de mensagens, ajuste de relógio e avanço de fase; o heartbeat é gravado a cada 10 segundos.
- Aura, vidas, sequência, combos e progresso são calculados no servidor. O cliente só manda a tecla, a partida, a rodada e um identificador do movimento. Revisões impedem respostas antigas de sobrescrever o estado novo.

## Verificação local

npm test executa testes do solo, multiplayer local preservado, controles mobile, timeline online, cliente e o SQL real em PostgreSQL local via PGlite. Nenhuma conexão Supabase é necessária para esses testes. As roles e auth.uid são simuladas somente no banco local dos testes. Eles não validam o transporte WebSocket do seu projeto real; a etapa de dois aparelhos acima continua necessária.

npm run build gera dist. O aviso de bundle acima de 500 kB vem do conjunto Three.js e SDK e não impede o build.
