import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { managedSpawnOptions, windowsTaskkillArgs } from '../process-supervisor.mjs';
import { mavenInvocation, resolveMavenRepository, root } from '../run-java-maven.mjs';

test('Maven uses the project-isolated repository by default', () => {
  assert.equal(resolveMavenRepository({}), path.join(root, 'apps', 'java-api', '.mvn', 'repository'));
  const invocation = mavenInvocation(['verify'], {}, 'win32');
  assert.equal(invocation.wrapper, 'cmd.exe');
  assert.equal(invocation.options.shell, false);
  assert.match(invocation.args.find((value) => value.startsWith('-Dmaven.repo.local=')), /apps[\\/]java-api[\\/]\.mvn[\\/]repository$/);
});

test('Maven repository override resolves relative to the project root', () => {
  assert.equal(resolveMavenRepository({ ROBOT_MAVEN_REPOSITORY: '.cache/java' }), path.join(root, '.cache', 'java'));
});

test('managed process groups and Windows tree termination stay scoped to the child PID', () => {
  assert.deepEqual(windowsTaskkillArgs(1234), ['/PID', '1234', '/T']);
  assert.deepEqual(windowsTaskkillArgs(1234, true), ['/PID', '1234', '/T', '/F']);
  assert.equal(managedSpawnOptions('linux').detached, true);
  assert.equal(managedSpawnOptions('win32').detached, false);
});
