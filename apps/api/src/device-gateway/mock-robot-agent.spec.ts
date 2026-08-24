import { otaScenarioSteps } from './mock-robot-agent';

describe('MockRobotAgent OTA scenarios', () => {
  it('never installs an artifact after checksum verification fails', () => {
    const steps = otaScenarioSteps('OTA_CHECKSUM_FAILURE');
    expect(steps.map((step) => step.status)).toEqual(['DOWNLOADING', 'VERIFYING', 'FAILED']);
    expect(steps.at(-1)?.reasonCode).toBe('CHECKSUM_MISMATCH');
  });

  it('recovers the previous version after a boot health failure', () => {
    const steps = otaScenarioSteps('OTA_BOOT_FAILURE');
    expect(steps.map((step) => step.status)).toEqual([
      'DOWNLOADING', 'VERIFYING', 'INSTALLING', 'REBOOTING', 'FAILED', 'ROLLED_BACK',
    ]);
  });

  it('runs the complete validated success state machine', () => {
    expect(otaScenarioSteps('OTA_SUCCESS').map((step) => step.status)).toEqual([
      'DOWNLOADING', 'VERIFYING', 'INSTALLING', 'REBOOTING', 'VALIDATING', 'SUCCEEDED',
    ]);
  });
});
