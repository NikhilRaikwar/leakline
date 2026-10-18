import type { Run } from './api';

const HISTORY_KEY = 'leakline_recent_runs';

export function saveRecentRun(run: Run) {
  const current = getRecentRunIds();
  const next = [run.analysis_id, ...current.filter(id => id !== run.analysis_id)].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  localStorage.setItem('leakline_run', run.analysis_id);
  window.dispatchEvent(new Event('leakline-run-updated'));
}

export function getRecentRunIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)) : [];
  } catch { return []; }
}
