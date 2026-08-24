import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function advisoryIds(name, vulnerability) {
  const ids = [];
  for (const item of vulnerability.via ?? []) {
    if (typeof item === 'object' && item !== null && item.severity === 'high') {
      const match = /\/advisories\/(GHSA-[0-9a-z-]+)$/i.exec(item.url ?? '');
      ids.push(match?.[1]?.toUpperCase() ?? `${name}:${item.title ?? 'high'}`);
    }
  }
  if (ids.length) return ids;
  if ((vulnerability.via ?? []).some((item) => typeof item === 'string')) return [];
  return vulnerability.severity === 'high' ? [`package:${name}`] : [];
}

export function validateAudit(audit, baseline, now = new Date()) {
  const reviewedAt = new Date(`${baseline.reviewedAt}T00:00:00Z`);
  const maximumExpiry = new Date(reviewedAt);
  maximumExpiry.setUTCDate(maximumExpiry.getUTCDate() + 90);
  const approved = new Map(baseline.exceptions.map((item) => [item.id.toUpperCase(), item]));
  const failures = [];
  if (Number.isNaN(reviewedAt.getTime())) failures.push('Vulnerability baseline reviewedAt is invalid');
  for (const item of baseline.exceptions) {
    if (!item.owner || !item.reason || Number.isNaN(Date.parse(item.expiresOn))) failures.push(`Invalid baseline entry ${item.id}`);
    else if (new Date(`${item.expiresOn}T00:00:00Z`) > maximumExpiry) failures.push(`Vulnerability exception exceeds 90 days ${item.id}`);
    else if (new Date(`${item.expiresOn}T23:59:59Z`) < now) failures.push(`Expired vulnerability exception ${item.id}`);
  }
  for (const [name, vulnerability] of Object.entries(audit.vulnerabilities ?? {})) {
    if (vulnerability.severity === 'critical') failures.push(`Critical vulnerability in ${name}`);
    for (const id of advisoryIds(name, vulnerability)) if (!approved.has(id)) failures.push(`Unapproved high vulnerability ${id} in ${name}`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return { exceptions: approved.size };
}

async function main() {
  const [auditPath, baselinePath] = process.argv.slice(2);
  const result = validateAudit(JSON.parse(await readFile(auditPath, 'utf8')), JSON.parse(await readFile(baselinePath, 'utf8')));
  console.log(`Vulnerability policy passed (${result.exceptions} reviewed exception(s))`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
