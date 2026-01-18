type LockState = {
  count: number;
  previousOverflow: string;
};

const getState = (): LockState | null => {
  if (typeof document === 'undefined') return null;
  const body = document.body;
  const rawCount = body.dataset.appScrollLockCount;
  const count = rawCount ? Number(rawCount) : 0;
  const previousOverflow = body.dataset.appScrollLockPrevOverflow ?? '';
  return {
    count: Number.isFinite(count) ? count : 0,
    previousOverflow,
  };
};

const setState = (state: LockState) => {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.dataset.appScrollLockCount = String(state.count);
  body.dataset.appScrollLockPrevOverflow = state.previousOverflow;
};

const clearState = () => {
  if (typeof document === 'undefined') return;
  const body = document.body;
  delete body.dataset.appScrollLockCount;
  delete body.dataset.appScrollLockPrevOverflow;
};

export const lockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  const body = document.body;

  const state = getState() ?? { count: 0, previousOverflow: '' };
  if (!Number.isFinite(state.count) || state.count < 0) {
    state.count = 0;
  }
  if (state.count === 0) {
    state.previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
  }

  state.count += 1;
  setState(state);
};

export const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  const body = document.body;

  const state = getState();
  if (!state || !Number.isFinite(state.count) || state.count <= 0) {
    // Nothing to unlock; leave as-is.
    return;
  }

  state.count -= 1;
  if (state.count === 0) {
    body.style.overflow = state.previousOverflow;
    clearState();
    return;
  }

  setState(state);
};
