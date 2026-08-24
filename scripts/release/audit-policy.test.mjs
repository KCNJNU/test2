import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAudit } from './audit-policy.mjs';

const audit = (severity = 'high', id = 'GHSA-aaaa-bbbb-cccc') => ({ vulnerabilities: { package: { severity, via: [{ severity, url: `https://github.com/advisories/${id}`, title: 'issue' }] } } });
const baseline = (id = 'GHSA-AAAA-BBBB-CCCC', expiresOn = '2026-11-21') => ({ reviewedAt: '2026-08-23', exceptions: [{ id, owner: 'security', reason: 'reviewed', expiresOn }] });

test('allows an active reviewed high-severity exception', () => {
  assert.equal(validateAudit(audit(), baseline(), new Date('2026-08-23')).exceptions, 1);
});

test('blocks new high, any critical and expired exceptions', () => {
  assert.throws(() => validateAudit(audit(), { reviewedAt: '2026-08-23', exceptions: [] }), /Unapproved high/);
  assert.throws(() => validateAudit(audit('critical'), { reviewedAt: '2026-08-23', exceptions: [] }), /Critical/);
  assert.throws(() => validateAudit(audit(), baseline(undefined, '2026-08-22'), new Date('2026-08-23')), /Expired/);
  assert.throws(() => validateAudit(audit(), baseline(undefined, '2026-11-22'), new Date('2026-08-23')), /exceeds 90 days/);
});
