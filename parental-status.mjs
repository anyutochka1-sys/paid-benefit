// Decree No. 2330, paragraph 33. Imprisonment of a separate parent does not
// create sole-parent status; it is a different circumstance under paragraph 31.
const sole = new Set(['blank', 'mother-statement', 'dead', 'declared-dead', 'missing']);
const other = new Set(['recorded', 'imprisoned', 'deprived-rights']);

export function soleParentStatus(children) {
  if (!children.length) return 'unknown';
  const statuses = children.map(child => child.secondParentStatus);
  if (statuses.some(status => !sole.has(status) && !other.has(status))) return 'unknown';
  if (statuses.every(status => sole.has(status))) return 'sole';
  if (statuses.every(status => other.has(status))) return 'other';
  return 'mixed';
}
