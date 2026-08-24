import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { superviseCommands } from './process-supervisor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const commands = [
  { label: 'api', command: node, args: [path.join(root, 'scripts', 'run-api-dev.mjs')], cwd: root },
  { label: 'mobile', command: node, args: [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'start'], cwd: path.join(root, 'apps', 'mobile') },
  { label: 'site', command: node, args: [vite, '--port', '5174'], cwd: path.join(root, 'apps', 'site') },
  { label: 'web', command: node, args: [vite], cwd: path.join(root, 'apps', 'web') },
];

process.exitCode = await superviseCommands(commands);
