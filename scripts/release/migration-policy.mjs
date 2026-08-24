import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORBIDDEN = [
  ['DROP statement', /\bDROP\s+(?:TABLE|COLUMN|TYPE|SCHEMA)\b/i],
  ['destructive rename', /\bALTER\s+(?:TABLE|TYPE)\b[\s\S]*?\bRENAME\s+(?:TO|COLUMN|VALUE)\b/i],
  ['column type replacement', /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i],
  ['immediate NOT NULL constraint', /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+NOT\s+NULL\b/i],
  ['table truncation', /\bTRUNCATE\b/i],
];

export function inspectMigration(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  return FORBIDDEN.filter(([, pattern]) => pattern.test(normalized)).map(([name]) => name);
}

export function changedMigrations(base) {
  if (!base) {
    const root = 'apps/api/prisma/migrations';
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name, 'migration.sql'))
      .filter(existsSync)
      .map((file) => posix.normalize(file.replaceAll('\\', '/')))
      .sort();
  }
  return execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`, '--', 'apps/api/prisma/migrations/*/migration.sql'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
}

async function main() {
  const files = changedMigrations(process.argv[2]);
  const failures = [];
  for (const file of files) for (const issue of inspectMigration(await readFile(file, 'utf8'))) failures.push(`${file}: ${issue}`);
  if (failures.length) throw new Error(`Backward-incompatible migration patterns detected:\n${failures.join('\n')}`);
  console.log(`Migration compatibility policy passed (${files.length} file(s) checked)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
