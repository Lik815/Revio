// Temporary performance instrumentation for the Termin-/Patienten-Detail perf work.
// No-ops outside __DEV__, so it never reaches production logs. Safe to delete once
// the measurements have been taken and the fixes are validated.

const tapMarks = new Map();

export function markTap(key) {
  if (!__DEV__ || key == null) return;
  tapMarks.set(key, performance.now());
}

export function markMounted(key, label) {
  if (!__DEV__) return;
  const tappedAt = key != null ? tapMarks.get(key) : null;
  if (key != null) tapMarks.delete(key);
  if (tappedAt == null) {
    console.log(`[perf] ${label} mounted (no tap mark for "${key}")`);
    return;
  }
  console.log(`[perf] ${label} mounted ${(performance.now() - tappedAt).toFixed(0)}ms after tap`);
}

export function mark(label) {
  if (!__DEV__) return;
  console.log(`[perf] ${label} @ ${performance.now().toFixed(0)}ms`);
}

export async function timedFetch(label, url, options) {
  if (!__DEV__) return fetch(url, options);
  const startedAt = performance.now();
  console.log(`[perf] ${label} fetch started`);
  try {
    const res = await fetch(url, options);
    console.log(`[perf] ${label} fetch finished in ${(performance.now() - startedAt).toFixed(0)}ms (status ${res.status})`);
    return res;
  } catch (err) {
    console.log(`[perf] ${label} fetch failed after ${(performance.now() - startedAt).toFixed(0)}ms: ${err?.message ?? err}`);
    throw err;
  }
}
