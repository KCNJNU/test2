import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('runtime images declare non-root users, health checks, and immutable build identity', async () => {
  const [nest, java, web] = await Promise.all([
    read('apps/api/Dockerfile'),
    read('apps/java-api/Dockerfile'),
    read('apps/web/Dockerfile'),
  ]);
  for (const dockerfile of [nest, java, web]) {
    assert.match(dockerfile, /org\.opencontainers\.image\.revision/);
    assert.match(dockerfile, /HEALTHCHECK/);
    assert.match(dockerfile, /USER (?:node|platform|101)/);
  }
  assert.match(nest, /dvc\[s3\]==3\.67\.1/);
  assert.doesNotMatch(nest, /HEALTHCHECK NONE/);
  assert.match(nest, /CMD \["node", "apps\/api\/dist\/worker\.js"\]/);
  assert.match(nest, /CMD \["\.\/node_modules\/\.bin\/prisma", "migrate", "deploy"/);
});

test('release compose hardens workloads and requires immutable image variables', async () => {
  const compose = await Promise.all([
    read('deploy/compose/slot.yml'),
    read('deploy/compose/singletons.yml'),
    read('deploy/compose/migration.yml'),
    read('deploy/compose/edge.yml'),
  ]);
  for (const yaml of compose) {
    assert.match(yaml, /read_only: true/);
    assert.match(yaml, /cap_drop: \[ALL\]/);
    assert.doesNotMatch(yaml, /image:\s+[^$\n]*:latest\b/);
  }
  assert.match(compose.join('\n'), /immutable EDGE_IMAGE is required/);
});

test('web exposes health and version routes and separates Java and Nest proxies', async () => {
  const nginx = await read('apps/web/nginx/default.conf.template');
  assert.match(nginx, /location = \/healthz/);
  assert.match(nginx, /location = \/version\.json/);
  assert.match(nginx, /location \/api\//);
  assert.match(nginx, /location = \/api\/health/);
  assert.match(nginx, /proxy_pass http:\/\/\$\{JAVA_UPSTREAM\}/);
  assert.match(nginx, /location \/nest\//);
  assert.match(nginx, /proxy_pass http:\/\/\$\{NEST_UPSTREAM\}\//);
});

test('host rollout migrates before cutover and rollback never reverses schema', async () => {
  const [deploy, rollback] = await Promise.all([
    read('deploy/host/deploy-release.sh'),
    read('deploy/host/rollback-release.sh'),
  ]);
  const migration = deploy.indexOf('compose/migration.yml');
  const cutover = deploy.indexOf('activate_slot "$target_slot"');
  const singletons = deploy.indexOf('compose/singletons.yml', cutover);
  assert.ok(migration >= 0 && cutover > migration && singletons > cutover);
  assert.match(deploy, /result:\$result/);
  assert.match(rollback, /Rollback target must be the recorded previous stable release/);
  assert.doesNotMatch(rollback, /migrate\s+(?:down|reset)|migration\.yml/);
  assert.match(rollback, /database schema was not downgraded/);
});
