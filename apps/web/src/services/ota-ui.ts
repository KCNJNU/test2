export function shortChecksum(value?: string) {
  return value && /^[a-f0-9]{64}$/i.test(value) ? `${value.slice(0, 12)}…${value.slice(-8)}` : value ?? '--';
}

export function rolloutRobotIds(strategy: string, value?: string) {
  const ids = (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  if (strategy === 'SINGLE' && ids.length !== 1) throw new Error('SINGLE rollout requires exactly one Robot ID');
  if (strategy === 'SELECTED_BATCH' && ids.length < 1) throw new Error('Selected batch requires Robot IDs');
  if ((strategy === 'PROJECT' || strategy === 'PERCENTAGE') && ids.length) throw new Error('Robot IDs are not accepted for broad rollout');
  return ids;
}

export function requiresIndependentApproval(category: string) {
  return category === 'SAFETY';
}
