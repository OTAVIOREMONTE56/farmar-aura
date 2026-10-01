const SOUND_KEY = 'farmar-aura-music-muted';
const PLAY_VOLUME = .35;
const GAME_OVER_VOLUME = .10;

// One media element and one optional gain node for mobile volume support.
export function createBackgroundMusic() {
  const audio = new Audio('/assets/audio/Arcade%20Groove.mp3');
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === 'true'; } catch {}
  audio.muted = muted;
  let context = null, gain = null, source = null;
  let started = false, disposed = false, phase = 'ready';
  let volume = 0, from = 0, target = 0, fadeStart = 0;
  const fadeDuration = 1000;

  function setVolume(value) {
    volume = value;
    if (gain) gain.gain.value = value;
    else audio.volume = value;
  }
  function fadeTo(value) {
    if (target === value) return;
    from = volume; target = value; fadeStart = performance.now();
  }
  function start() {
    if (disposed) return;
    // Called synchronously from the start/retry or sound-button gesture.
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        try {
          context = new AudioContext();
          source = context.createMediaElementSource(audio);
          gain = context.createGain();
          gain.gain.value = volume;
          source.connect(gain); gain.connect(context.destination);
          audio.volume = 1;
        } catch {
          if (source && context) source.connect(context.destination);
          gain = null;
          audio.volume = volume;
        }
      }
    }
    try { context?.resume()?.catch(() => {}); } catch {}
    started = true;
    fadeTo(phase === 'result' ? GAME_OVER_VOLUME : PLAY_VOLUME);
    try { audio.play()?.catch(() => {}); } catch {}
  }
  return {
    get muted() { return muted; },
    start,
    toggle() {
      muted = !muted;
      audio.muted = muted;
      try { localStorage.setItem(SOUND_KEY, String(muted)); } catch {}
      if (!muted && started) start();
    },
    update(nextPhase, now = performance.now()) {
      if (disposed) return;
      if (nextPhase !== phase) {
        phase = nextPhase;
        if (started) fadeTo(phase === 'result' ? GAME_OVER_VOLUME : PLAY_VOLUME);
      }
      if (volume !== target) {
        const progress = Math.min(1, Math.max(0, (now - fadeStart) / fadeDuration));
        const eased = progress * progress * (3 - 2 * progress);
        setVolume(from + (target - from) * eased);
      }
    },
    dispose() {
      disposed = true; audio.pause();
      audio.removeAttribute('src'); audio.load();
      source?.disconnect(); gain?.disconnect();
      try { context?.close()?.catch(() => {}); } catch {}
    },
  };
}
