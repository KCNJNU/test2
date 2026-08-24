import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const REQUIRED_IMAGES = ['java-api', 'migration', 'nest', 'web', 'worker'];
const SEMVER = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const COMMIT = /^[0-9a-f]{40}$/i;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPOSITORY = /^ghcr\.io\/[a-z0-9._/-]+$/;

export function validateManifest(value, expected = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Release manifest must be an object');
  requireText(value.version, 'version', SEMVER, 64);
  requireText(value.gitCommit, 'gitCommit', COMMIT, 40);
  if (Number.isNaN(Date.parse(value.buildTime))) throw new Error('buildTime must be an ISO timestamp');
  requireText(value.releaseNote, 'releaseNote', /^[^\u0000-\u001f]+$/s, 4000);
  requireText(value.sourceWorkflow, 'sourceWorkflow', /^[A-Za-z0-9._/-]+$/, 160);
  if (!Array.isArray(value.images)) throw new Error('images must be an array');
  const names = new Set();
  for (const image of value.images) {
    requireText(image?.name, 'image.name', /^[a-z0-9-]+$/, 40);
    requireText(image?.repository, 'image.repository', REPOSITORY, 240);
    requireText(image?.digest, 'image.digest', DIGEST, 71);
    if (names.has(image.name)) throw new Error(`Duplicate image ${image.name}`);
    names.add(image.name);
  }
  for (const name of REQUIRED_IMAGES) if (!names.has(name)) throw new Error(`Missing required image ${name}`);
  if (names.size !== REQUIRED_IMAGES.length) throw new Error('Manifest contains an unsupported image');
  if (expected.version && value.version !== expected.version) throw new Error('Manifest version does not match the requested version');
  if (expected.gitCommit && value.gitCommit.toLowerCase() !== expected.gitCommit.toLowerCase()) throw new Error('Manifest commit does not match the requested commit');
  return value;
}

export function createManifest(environment = process.env) {
  const images = REQUIRED_IMAGES.map((name) => {
    const key = name.replaceAll('-', '_').toUpperCase();
    return { name, repository: environment[`IMAGE_${key}_REPOSITORY`], digest: environment[`IMAGE_${key}_DIGEST`] };
  });
  return validateManifest({
    version: environment.RELEASE_VERSION,
    gitCommit: environment.GIT_COMMIT,
    buildTime: environment.BUILD_TIME,
    releaseNote: environment.RELEASE_NOTE,
    sourceWorkflow: environment.SOURCE_WORKFLOW,
    images,
  });
}

function requireText(value, name, pattern, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !pattern.test(value)) throw new Error(`${name} is invalid`);
}

async function main() {
  const [command, path, expectedVersion, expectedCommit] = process.argv.slice(2);
  if (command === 'create') {
    if (!path) throw new Error('Output path is required');
    await writeFile(path, `${JSON.stringify(createManifest(), null, 2)}\n`, { flag: 'wx' });
  } else if (command === 'validate') {
    if (!path) throw new Error('Manifest path is required');
    validateManifest(JSON.parse(await readFile(path, 'utf8')), { version: expectedVersion, gitCommit: expectedCommit });
  } else throw new Error('Usage: release-manifest.mjs create <path> | validate <path> [version] [commit]');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
