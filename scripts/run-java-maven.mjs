import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveMavenRepository(environment = process.env) {
  const configured = environment.ROBOT_MAVEN_REPOSITORY?.trim();
  if (!configured) return path.join(root, 'apps', 'java-api', '.mvn', 'repository');
  return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
}

export function mavenInvocation(args = process.argv.slice(2), environment = process.env, platform = process.platform) {
  const windows = platform === 'win32';
  const wrapper = path.join(root, 'apps', 'java-api', windows ? 'mvnw.cmd' : 'mvnw');
  const mavenArgs = [
    `-Dmaven.repo.local=${resolveMavenRepository(environment)}`,
    '-f',
    path.join(root, 'apps', 'java-api', 'pom.xml'),
    ...args,
  ];
  return {
    wrapper: windows ? (environment.ComSpec || environment.COMSPEC || 'cmd.exe') : wrapper,
    args: windows ? ['/d', '/s', '/c', wrapper, ...mavenArgs] : mavenArgs,
    options: { cwd: root, stdio: 'inherit', shell: false },
  };
}

export function main() {
  const invocation = mavenInvocation();
  const result = spawnSync(invocation.wrapper, invocation.args, invocation.options);
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
