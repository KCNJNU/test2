import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('production EMQX is mutual-TLS-only and defaults to deny', async () => {
  const [compose, config, acl, deployment] = await Promise.all([read('deploy/compose/production-infrastructure.yml'), read('deploy/emqx/emqx.conf'), read('deploy/emqx/acl.conf'), read('deploy/deployment.env.example')]);
  assert.match(compose, /EMQX_IMAGE.*digest/);
  assert.doesNotMatch(compose, /1883:1883/);
  assert.match(config, /listeners\.tcp\.default\.enable = false/);
  assert.match(config, /verify = verify_peer/);
  assert.match(config, /fail_if_no_peer_cert = true/);
  assert.match(config, /enable_crl_check = true/);
  assert.match(config, /crl_cache[\s\S]*refresh_interval = 15m/);
  assert.match(acl, /robots\/\$\{username\}\/commands/);
  assert.match(acl, /\{deny, all\}\./);
  assert.match(deployment, /EMQX_IMAGE=emqx\/emqx@sha256:4dcdd8a7c053750b550c8a4c5b30a3cfb012edaebe041f84245b1633fab7b77a/);
});

test('Vault Agent removes bootstrap identity and renders restrictive files', async () => {
  const agent = await read('deploy/vault/agent.hcl');
  assert.match(agent, /remove_secret_id_file_after_reading = true/);
  assert.doesNotMatch(agent, /sink\s+"file"/);
  assert.match(agent, /perms = "0400"/);
  assert.match(agent, /error_on_missing_key = true/);
});

test('backup and restore automation has immutable images and destructive target guards', async () => {
  const [backup, restore, maintenance] = await Promise.all([read('deploy/backup/backup.sh'), read('deploy/backup/restore-drill.sh'), read('deploy/backup/maintenance.sh')]);
  assert.match(backup, /@sha256:/);
  assert.match(backup, /DATABASE_BACKUP/);
  assert.match(backup, /OBJECT_BACKUP/);
  assert.match(restore, /RESTORE_DATABASE_URL != "\$DATABASE_URL"/);
  assert.match(restore, /\/var\/lib\/robot-platform-restore/);
  assert.match(restore, /realpath/);
  assert.match(maintenance, /--dry-run/);
  assert.match(maintenance, /APPLY_BACKUP_RETENTION/);
});

test('public web proxies reject internal resilience evidence', async () => {
  const [web, edge] = await Promise.all([read('apps/web/nginx/default.conf.template'), read('deploy/edge/production.conf')]);
  assert.match(web, /location \^~ \/api\/internal\//);
  assert.match(edge, /location \^~ \/api\/internal\//);
  assert.match(edge, /ssl_protocols TLSv1\.2 TLSv1\.3/);
  assert.match(edge, /Strict-Transport-Security/);
});
