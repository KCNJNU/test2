import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectMigration } from './migration-policy.mjs';

test('accepts additive expand migrations', () => {
  assert.deepEqual(inspectMigration('ALTER TABLE "Robot" ADD COLUMN "region" TEXT;'), []);
});

test('rejects destructive or immediate contract migrations', () => {
  assert.deepEqual(inspectMigration('ALTER TABLE "Robot" DROP COLUMN "name";'), ['DROP statement']);
  assert.deepEqual(inspectMigration('ALTER TABLE "Robot" ALTER COLUMN "name" SET NOT NULL;'), ['immediate NOT NULL constraint']);
});

test('does not evaluate policy keywords inside comments', () => {
  assert.deepEqual(inspectMigration('-- DROP TABLE Robot\nCREATE TABLE "Safe" (id UUID);'), []);
});
