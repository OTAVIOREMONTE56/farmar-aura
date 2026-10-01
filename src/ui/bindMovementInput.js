// Touch gestures submit once on release; mouse and accessible clicks remain native.
export function bindMovementInput(buttons, submit) {
  let active = null, suppressClickUntil = 0;
  const removers = [];
  const listen = (button, type, handler) => {
    button.addEventListener(type, handler);
    removers.push(() => button.removeEventListener(type, handler));
  };
  function clear() {
    active?.button.classList.remove('touch-pressed');
    active = null;
  }
  for (const {button, movement} of buttons) {
    listen(button, 'pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      event.preventDefault();
      if (!event.isPrimary || active || button.disabled) return;
      active = {id:event.pointerId, button};
      button.classList.add('touch-pressed');
      button.setPointerCapture(event.pointerId);
    });
    listen(button, 'pointerup', event => {
      if (event.pointerType === 'mouse') return;
      event.preventDefault();
      suppressClickUntil = performance.now() + 600;
      if (active?.id !== event.pointerId || active.button !== button) return;
      const rect = button.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      clear();
      if (inside && !button.disabled) submit(movement.key);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      listen(button, type, event => { if (active?.id === event.pointerId) clear(); });
    }
    listen(button, 'click', event => {
      if (event.detail !== 0 && performance.now() < suppressClickUntil) return;
      if (!button.disabled) submit(movement.key);
    });
  }
  return () => { clear(); removers.forEach(remove => remove()); };
}
