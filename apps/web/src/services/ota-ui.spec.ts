import { describe, expect, it } from 'vitest';
import { requiresIndependentApproval, rolloutRobotIds, shortChecksum } from './ota-ui';

describe('D5 OTA presentation rules', () => {
  it('renders a checksum without hiding that it is a checksum', () => {
    const hash = 'a'.repeat(64);
    expect(shortChecksum(hash)).toBe('aaaaaaaaaaaa…aaaaaaaa');
  });

  it('requires exactly one explicit robot for a single canary', () => {
    expect(rolloutRobotIds('SINGLE', 'robot-1')).toEqual(['robot-1']);
    expect(() => rolloutRobotIds('SINGLE', '')).toThrow('exactly one');
    expect(() => rolloutRobotIds('SINGLE', 'robot-1,robot-2')).toThrow('exactly one');
  });

  it('never treats project rollout as an implicit robot selection', () => {
    expect(rolloutRobotIds('PROJECT')).toEqual([]);
    expect(() => rolloutRobotIds('PROJECT', 'robot-1')).toThrow('not accepted');
  });

  it('identifies L4 Safety as independently approved configuration', () => {
    expect(requiresIndependentApproval('SAFETY')).toBe(true);
    expect(requiresIndependentApproval('NAVIGATION')).toBe(false);
  });
});
