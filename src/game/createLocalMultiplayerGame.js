import { MOVEMENTS } from '../entities/character/createMovementController.js';

export const LOCAL_ROUNDS = 5;
export const FIRST_FINISH_BONUS = 50;
const SAME_FINISH_WINDOW = 30;

// Local match state is independent of the solo game and its persistent records.
export function createLocalMultiplayerGame(characters, { rounds = LOCAL_ROUNDS, random = Math.random, now = () => performance.now() } = {}) {
  if (characters.length !== 2) throw new Error('O modo local precisa de dois personagens.');
  let phase = 'ready', level = 1, sequence = [], players = [], due = 0;
  let demoIndex = -1, demoMoving = false, firstAt = null, lastLeader = null, goUntil = 0;
  const pause = () => Math.max(260, 750 - (level - 1) * 45);
  const append = () => sequence.push(MOVEMENTS[Math.min(5, Math.max(0, Math.floor(random() * 6)))]);
  const ready = player => player.lives > 0;
  function feedback(player, text, time, duration = 1100) {
    player.feedback = text; player.feedbackUntil = time + duration;
  }
  function trackLeader(time) {
    const leader = players[0].score === players[1].score ? null : players[0].score > players[1].score ? 0 : 1;
    if (leader !== null) {
      if (lastLeader !== null && leader !== lastLeader) players[leader].leadUntil = time + 1400;
      lastLeader = leader;
    }
  }
  function beginRound(time) {
    firstAt = null; demoIndex = -1; demoMoving = false;
    players.forEach(player => {
      player.index = 0; player.roundStart = player.score; player.roundHadError = false;
      player.first = false; player.finishedAt = null; player.retryIndex = -1;
      player.feedback = ''; player.status = ready(player) ? 'waiting' : 'out';
    });
    phase = 'memorize-intro'; due = time + 1100;
  }
  function start(time = now()) {
    if (!['ready', 'result'].includes(phase)) return false;
    characters.forEach(character => {
      character.stopAnimation({ fade: 0 }); character.mixer.stopAllAction();
      character.playAnimation('idle', { fade: 0, loop: true });
    });
    level = 1; sequence = []; lastLeader = null; goUntil = 0;
    players = characters.map(() => ({ status: 'waiting', lives: 3, score: 0, combo: 1, cleanWins: 0,
      index: 0, roundStart: 0, roundHadError: false, first: false, finishedAt: null,
      feedback: '', feedbackUntil: 0, leadUntil: 0, retryIndex: -1, retryMoving: false, due: 0 }));
    append(); append(); beginRound(time); return true;
  }
  function finishPlayer(player, time) {
    player.score += 100 * level + (player.roundHadError ? 0 : 50);
    player.cleanWins = player.roundHadError ? 0 : player.cleanWins + 1;
    player.combo = Math.max(1, player.cleanWins); player.status = 'finished';
    feedback(player, player.first ? '🔥 TERMINOU PRIMEIRO!' : '⭐ SEQUÊNCIA COMPLETA!', time, 3000);
    trackLeader(time);
  }
  function updatePlayer(player, character, time) {
    if (player.status === 'moving' && !character.movements.busy) {
      if (player.index === sequence.length) finishPlayer(player, time);
      else player.status = 'player';
    } else if (player.status === 'error' && time >= player.due) {
      player.status = 'retry-intro'; player.due = time + 1100;
    } else if (player.status === 'retry-intro' && time >= player.due) {
      player.status = 'retry-demo'; player.retryIndex = -1; player.retryMoving = false; player.due = time;
    } else if (player.status === 'retry-demo') {
      if (player.retryMoving) {
        if (!character.movements.busy) { player.retryMoving = false; player.due = time + pause(); }
      } else if (time >= player.due) {
        if (player.retryIndex + 1 >= sequence.length) {
          player.status = 'retry-turn'; player.due = time + 1000;
        } else if (character.movements.play(sequence[player.retryIndex + 1].name)) {
          player.retryIndex++; player.retryMoving = true;
        }
      }
    } else if (player.status === 'retry-turn' && time >= player.due) player.status = 'player';
  }
  function update(time = now()) {
    if (phase === 'memorize-intro' && time >= due) { phase = 'demonstrate'; due = time; }
    else if (phase === 'demonstrate') {
      if (demoMoving) {
        if (characters.every(character => !character.movements.busy)) { demoMoving = false; due = time + pause(); }
      } else if (time >= due) {
        if (demoIndex + 1 >= sequence.length) { phase = 'countdown'; demoIndex = -1; due = time + 3000; }
        else if (characters.every(character => !character.movements.busy)) {
          const next = sequence[demoIndex + 1];
          if (characters.every(character => character.movements.play(next.name))) { demoIndex++; demoMoving = true; }
        }
      }
    } else if (phase === 'countdown' && time >= due) {
      phase = 'play'; goUntil = time + 750;
      players.forEach(player => { if (ready(player)) player.status = 'player'; });
    } else if (phase === 'play') {
      players.forEach((player, index) => updatePlayer(player, characters[index], time));
      if (players.every(player => ['finished', 'out'].includes(player.status))) { phase = 'round-result'; due = time + 2400; }
    } else if (phase === 'round-result' && time >= due) {
      if (level >= rounds || players.every(player => !ready(player))) phase = 'result';
      else { level++; append(); beginRound(time); }
    }
  }
  function input(playerIndex, key, time = now()) {
    update(time);
    const player = players[playerIndex], character = characters[playerIndex];
    if (!player || phase !== 'play' || player.status !== 'player' || character.movements.busy) return { kind: 'ignored' };
    const movement = MOVEMENTS.find(move => move.key === key);
    if (!movement) return { kind: 'ignored' };
    if (key !== sequence[player.index].key) {
      player.lives--; player.combo = 1; player.cleanWins = 0; player.roundHadError = true; player.index = 0;
      player.status = player.lives ? 'error' : 'out'; player.due = time + 1200;
      feedback(player, player.lives ? 'OPA! 🐸 TENTE DE NOVO!' : '🐸 BOA! TORÇA PELO AMIGO!', time, 1800);
      return { kind: 'error' };
    }
    if (!character.movements.play(movement.name)) return { kind: 'ignored' };
    player.index++; player.score += 25; player.status = 'moving';
    feedback(player, 'BOA! ⭐ +25 AURA', time);
    if (player.index === sequence.length) {
      player.finishedAt = time;
      firstAt ??= time;
      // Gestures arriving in the same display frame may share the first-place bonus.
      if (time - firstAt <= SAME_FINISH_WINDOW) {
        player.first = true; player.score += FIRST_FINISH_BONUS;
        feedback(player, '🔥 TERMINOU PRIMEIRO! +50 AURA', time, 3000);
      }
    }
    trackLeader(time); return { kind: 'hit' };
  }
  function snapshot(time = now()) {
    const demonstration = phase === 'demonstrate' && demoIndex >= 0 ? { ...sequence[demoIndex], index: demoIndex + 1 } : null;
    return { phase, level, rounds, length: sequence.length,
      countdown: phase === 'countdown' ? Math.max(1, Math.ceil((due - time) / 1000)) : null,
      go: phase === 'play' && time < goUntil, demonstration,
      duoPerfect: players.length === 2 && players.every(player => player.status === 'finished' && !player.roundHadError),
      winner: players.length < 2 || players[0].score === players[1].score ? null : players[0].score > players[1].score ? 0 : 1,
      players: players.map((player, index) => ({ ...player,
        canInput: phase === 'play' && player.status === 'player' && !characters[index].movements.busy,
        roundAura: player.score - player.roundStart,
        feedback: time < player.feedbackUntil ? player.feedback : '', overtook: time < player.leadUntil,
        demonstration: demonstration ?? (player.status === 'retry-demo' && player.retryIndex >= 0 ? { ...sequence[player.retryIndex], index: player.retryIndex + 1 } : null),
      })),
    };
  }
  return { start, update, input, snapshot };
}
