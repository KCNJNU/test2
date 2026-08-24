import { spawn } from 'node:child_process';

const isRunning = (child) => Boolean(child?.pid) && child.exitCode == null && child.signalCode == null;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForExit(child, milliseconds) {
  if (!isRunning(child)) return true;
  return Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(milliseconds).then(() => false),
  ]);
}

export const windowsTaskkillArgs = (pid, force = false) => [
  '/PID', String(pid), '/T', ...(force ? ['/F'] : []),
];

export const managedSpawnOptions = (platform = process.platform) => ({
  stdio: 'inherit',
  detached: platform !== 'win32',
  windowsHide: true,
});

async function runTaskkill(pid, force, spawnProcess) {
  const killer = spawnProcess('taskkill.exe', windowsTaskkillArgs(pid, force), {
    stdio: 'ignore',
    windowsHide: true,
  });
  return new Promise((resolve) => {
    killer.once('error', () => resolve(false));
    killer.once('exit', (code) => resolve(code === 0));
  });
}

async function windowsDescendantPids(pid, spawnProcess) {
  const script = [
    '$rootPid = [int]$args[0]',
    '$rows = Get-Process -ErrorAction SilentlyContinue | ForEach-Object {',
    '  try { if ($_.Parent) { [pscustomobject]@{ Id = $_.Id; ParentId = $_.Parent.Id } } } catch {}',
    '}',
    '$descendants = @()',
    '$frontier = @($rootPid)',
    'while ($frontier.Count -gt 0) {',
    '  $next = @($rows | Where-Object { $frontier -contains $_.ParentId } | Select-Object -ExpandProperty Id)',
    '  $descendants += $next',
    '  $frontier = $next',
    '}',
    '$descendants | ConvertTo-Json -Compress',
  ].join('\n');
  const shell = spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script, String(pid)], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  let output = '';
  shell.stdout?.on('data', (chunk) => { output += chunk; });
  const succeeded = await new Promise((resolve) => {
    shell.once('error', () => resolve(false));
    shell.once('exit', (code) => resolve(code === 0));
  });
  if (!succeeded || !output.trim()) return [];
  try {
    const parsed = JSON.parse(output);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(Number.isInteger);
  } catch {
    return [];
  }
}

async function terminateWindowsFallback(child, signal, spawnProcess) {
  const descendants = await windowsDescendantPids(child.pid, spawnProcess);
  for (const pid of descendants.reverse()) {
    try { process.kill(pid, signal); } catch (error) { if (error?.code !== 'ESRCH') console.error(`Unable to stop child PID ${pid}:`, error.message); }
  }
  try { child.kill(signal); } catch (error) { if (error?.code !== 'ESRCH') console.error(`Unable to stop child PID ${child.pid}:`, error.message); }
}

export async function terminateProcessTree(child, {
  signal = 'SIGTERM',
  graceMilliseconds = 5_000,
  platform = process.platform,
  spawnProcess = spawn,
} = {}) {
  if (!isRunning(child)) return;
  if (platform === 'win32') {
    if (!(await runTaskkill(child.pid, false, spawnProcess))) await terminateWindowsFallback(child, signal, spawnProcess);
    if (!(await waitForExit(child, graceMilliseconds))) {
      if (!(await runTaskkill(child.pid, true, spawnProcess))) await terminateWindowsFallback(child, 'SIGTERM', spawnProcess);
      await waitForExit(child, graceMilliseconds);
    }
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') child.kill(signal);
  }
  if (!(await waitForExit(child, graceMilliseconds))) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (error?.code !== 'ESRCH') child.kill('SIGKILL');
    }
    await waitForExit(child, graceMilliseconds);
  }
}

function exitResult(child, label) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.once('error', (error) => finish({ label, code: 1, error }));
    child.once('exit', (code, signal) => finish({ label, code: code ?? (signal ? 1 : 0), signal }));
  });
}

export async function superviseCommands(commands, {
  spawnProcess = spawn,
  platform = process.platform,
  graceMilliseconds = 5_000,
} = {}) {
  const children = commands.map(({ label, command, args = [], cwd, env = process.env }) => ({
    label,
    child: spawnProcess(command, args, { ...managedSpawnOptions(platform), cwd, env }),
  }));
  const exits = children.map(({ child, label }) => exitResult(child, label));
  let stopPromise;
  let requestedExitCode;

  const stop = (exitCode, signal = 'SIGTERM') => {
    requestedExitCode ??= exitCode;
    stopPromise ??= Promise.all(children.map(({ child }) => terminateProcessTree(child, {
      signal,
      graceMilliseconds,
      platform,
      spawnProcess,
    })));
    return stopPromise;
  };

  const signalHandlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [
    signal,
    () => void stop(0, signal),
  ]));
  for (const [signal, handler] of signalHandlers) process.once(signal, handler);

  const first = await Promise.race(exits);
  if (first.error) console.error(`[${first.label}] failed to start:`, first.error);
  if (requestedExitCode == null) {
    const code = first.code === 0 ? 1 : first.code;
    console.error(`[${first.label}] exited unexpectedly (${first.signal ?? code}); stopping development processes.`);
    await stop(code);
  } else await stopPromise;
  await Promise.all(exits);

  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
  return requestedExitCode ?? 1;
}
