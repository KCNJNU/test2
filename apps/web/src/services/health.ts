import type { HealthStatus } from './api';

export const statusTone = (status: HealthStatus): 'default' | 'success' | 'warning' | 'error' => {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'unhealthy') return 'error';
  return 'default';
};
