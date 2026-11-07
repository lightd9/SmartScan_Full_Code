import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Run from either mobile app directory. Each APK contains its own built assets.
const project = process.cwd();
const windows = process.platform === 'win32';
const task = process.argv[2] || 'assembleDebug';
if (!['assembleDebug', 'bundleRelease'].includes(task)) throw new Error('Unsupported Android build task');
const env = { ...process.env };
const studioJdk = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const toolCache = join(homedir(), '.cache', 'smartscan-tools', 'jdk21');
const cachedJdks = existsSync(toolCache) ? readdirSync(toolCache, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(toolCache, entry.name)) : [];
if (windows) {
  const candidates = [env.JAVA_HOME, studioJdk, ...cachedJdks].filter(Boolean);
  const usable = candidates.find(dir => {
    if (!existsSync(join(dir, 'lib', 'jvm.cfg')) || !existsSync(join(dir, 'bin', 'javac.exe'))) return false;
    const check = spawnSync(join(dir, 'bin', 'java.exe'), ['-version'], { encoding: 'utf8', windowsHide: true });
    return check.status === 0 && /version "21[.\"]/.test(check.stderr || check.stdout);
  });
  if (!usable) throw new Error('Java 21 JDK is required. Set JAVA_HOME to a working JDK 21 installation.');
  env.JAVA_HOME = usable;
}
const sdk = windows && env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Android', 'Sdk') : null;
if (!env.ANDROID_HOME && sdk && existsSync(sdk)) env.ANDROID_HOME = sdk;

function run(command, args, cwd = project) {
  // Commands/arguments here are fixed tokens (task is allowlisted above).
  const executable = windows ? (env.ComSpec || 'cmd.exe') : command;
  const argumentsForProcess = windows ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args;
  const result = spawnSync(executable, argumentsForProcess, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
run(windows ? '.\\gradlew.bat' : './gradlew', [task, '--no-daemon', '--max-workers=2'], join(project, 'android'));
if (task === 'bundleRelease') console.log('Release bundle built. Configure your release signing identity before store distribution.');
