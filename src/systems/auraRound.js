export const ROUND_MS = 10000;
export const COMBOS = [1, 1.5, 2, 2.5, 3, 4];
export const BASE_AURA = { Q:60, W:100, E:120, R:80, T:90, Y:150 };
export function judgeTiming(elapsed, duration) {
  const progress = elapsed / duration;
  if (Math.abs(progress - .35) <= .16) return { label:'PERFEITO', multiplier:1.5 };
  if (progress < .8) return { label:'BOM', multiplier:1 };
  return { label:'ATRASADO', multiplier:.6 };
}
export function auraCategory(score) {
  if (score >= 2000) return 'AURA LENDÁRIA';
  if (score >= 1300) return 'AURA MONSTRUOSA';
  if (score >= 800) return 'AURA ABSURDA';
  if (score >= 400) return 'AURA RESPEITÁVEL';
  return 'AURA EM TREINAMENTO';
}
