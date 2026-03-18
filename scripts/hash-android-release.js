const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const outputsDir = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release');

if (!fs.existsSync(outputsDir)) {
  console.error(`Release output directory does not exist: ${outputsDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(outputsDir)
  .filter((name) => name.toLowerCase().endsWith('.apk'))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error(`No APK files found in: ${outputsDir}`);
  process.exit(1);
}

for (const name of files) {
  const filePath = path.join(outputsDir, name);
  const data = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const relativePath = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  console.log(`${sha256}  ${relativePath}`);
}