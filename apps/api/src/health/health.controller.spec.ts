import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns an ok status', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    expect(moduleRef.get(HealthController).getHealth()).toEqual({ status: 'ok' });
  });
});
