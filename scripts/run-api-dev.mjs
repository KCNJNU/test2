import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { superviseCommands } from './process-supervisor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDirectory = path.join(root, 'apps', 'api');
const commands = [
  {
    label: 'nest-api',
    command: process.execPath,
    args: [path.join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'), 'start', '--watch'],
    cwd: apiDirectory,
  },
  {
    label: 'operations-worker',
    command: process.execPath,
    args: [path.join(root, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--transpile-only', 'src/worker.ts'],
    cwd: apiDirectory,
  },
];
process.exitCode = await superviseCommands(commands);
