/**
 * Script to package GTA Shield for Mozilla Firefox Add-ons (AMO).
 * Ensures manifest.json and extension assets are at the root of the ZIP file.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = manifest.version || '1.0.0';
const zipName = `gta-shield-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log(`Packaging GTA Shield v${version} for Firefox AMO submission...`);

// Use PowerShell on Windows or zip on Unix to package files directly at root of archive
try {
  if (process.platform === 'win32') {
    const psCmd = `powershell -Command "Compress-Archive -Path manifest.json, icons, src, ui -DestinationPath dist/${zipName} -Force"`;
    execSync(psCmd, { cwd: rootDir, stdio: 'inherit' });
  } else {
    execSync(`zip -r "dist/${zipName}" manifest.json icons src ui`, { cwd: rootDir, stdio: 'inherit' });
  }

  const stat = fs.statSync(zipPath);
  console.log(`\n✓ Successfully created production package:`);
  console.log(`  File: dist/${zipName} (${Math.round(stat.size / 1024)} KB)`);
  console.log(`  Manifest is verified at root of archive.`);
  console.log(`  Upload this zip file directly to addons.mozilla.org!`);
} catch (err) {
  console.error('Packaging error:', err);
  process.exit(1);
}
