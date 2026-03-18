const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const androidDir = path.join(repoRoot, 'android');

const isWindows = process.platform === 'win32';
const command = isWindows ? 'gradlew.bat' : 'sh';
const args = isWindows
  ? ['--no-daemon', 'clean', 'assembleRelease']
  : ['./gradlew', '--no-daemon', 'clean', 'assembleRelease'];

const result = spawnSync(command, args, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}