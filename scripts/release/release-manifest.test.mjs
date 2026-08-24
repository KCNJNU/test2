import assert from 'node:assert/strict';
import test from 'node:test';
import { createManifest, validateManifest } from './release-manifest.mjs';

const environment = {
  RELEASE_VERSION: 'v1.2.3', GIT_COMMIT: 'a'.repeat(40), BUILD_TIME: '2026-08-23T00:00:00Z', RELEASE_NOTE: 'D4 release', SOURCE_WORKFLOW: 'images/123',
  ...Object.fromEntries(['JAVA_API', 'MIGRATION', 'NEST', 'WEB', 'WORKER'].flatMap((name) => [
    [`IMAGE_${name}_REPOSITORY`, `ghcr.io/kcnjnu/platform-${name.toLowerCase().replaceAll('_', '-')}`],
    [`IMAGE_${name}_DIGEST`, `sha256:${name.charCodeAt(0).toString(16).padStart(2, '0').repeat(32)}`],
  ])),
};

test('creates and validates an immutable release manifest', () => {
  const manifest = createManifest(environment);
  assert.equal(validateManifest(manifest, { version: 'v1.2.3', gitCommit: 'a'.repeat(40) }), manifest);
});

test('rejects mutable image tags and mismatched promotion commits', () => {
  const manifest = createManifest(environment);
  manifest.images[0].digest = 'latest';
  assert.throws(() => validateManifest(manifest), /image.digest/);
  assert.throws(() => validateManifest(createManifest(environment), { gitCommit: 'b'.repeat(40) }), /commit/);
});
