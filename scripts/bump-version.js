#!/usr/bin/env node
/**
 * Version Bump Script
 * Usage: node scripts/bump-version.js [major|minor|patch] or node scripts/bump-version.js 3.2.0
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const FILES = {
  packageJson: path.join(ROOT, 'package.json'),
  cargoToml: path.join(ROOT, 'src-tauri', 'Cargo.toml'),
  tauriConf: path.join(ROOT, 'src-tauri', 'tauri.conf.json'),
  sidebarJsx: path.join(ROOT, 'src', 'components', 'Sidebar.jsx'),
};

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(FILES.packageJson, 'utf8'));
  return pkg.version;
}

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function bumpVersion(current, type) {
  const { major, minor, patch } = parseVersion(current);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      // Assume it's a specific version string
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version type: ${type}. Use major, minor, patch, or X.Y.Z`);
  }
}

function updatePackageJson(newVersion) {
  const content = JSON.parse(fs.readFileSync(FILES.packageJson, 'utf8'));
  content.version = newVersion;
  fs.writeFileSync(FILES.packageJson, JSON.stringify(content, null, 2) + '\n');
  console.log(`✓ Updated package.json to ${newVersion}`);
}

function updateCargoToml(newVersion) {
  let content = fs.readFileSync(FILES.cargoToml, 'utf8');
  content = content.replace(/^version = "[\d.]+"$/m, `version = "${newVersion}"`);
  fs.writeFileSync(FILES.cargoToml, content);
  console.log(`✓ Updated Cargo.toml to ${newVersion}`);
}

function updateTauriConf(newVersion) {
  const content = JSON.parse(fs.readFileSync(FILES.tauriConf, 'utf8'));
  content.version = newVersion;
  fs.writeFileSync(FILES.tauriConf, JSON.stringify(content, null, 2) + '\n');
  console.log(`✓ Updated tauri.conf.json to ${newVersion}`);
}

function updateSidebarJsx(newVersion) {
  let content = fs.readFileSync(FILES.sidebarJsx, 'utf8');
  const shortVersion = `v${newVersion.split('.').slice(0, 2).join('.')}`;
  // Match patterns like: >v3.3 { or >v3.3.0 { or just version strings in sidebar-version div
  content = content.replace(/(sidebar-version">)v[\d.]+/g, `$1${shortVersion}`);
  fs.writeFileSync(FILES.sidebarJsx, content);
  console.log(`✓ Updated Sidebar.jsx to ${shortVersion}`);
}

function main() {
  const arg = process.argv[2] || 'patch';
  const currentVersion = getCurrentVersion();
  
  console.log(`\nCurrent version: ${currentVersion}`);
  
  const newVersion = bumpVersion(currentVersion, arg);
  
  console.log(`New version: ${newVersion}\n`);
  
  updatePackageJson(newVersion);
  updateCargoToml(newVersion);
  updateTauriConf(newVersion);
  updateSidebarJsx(newVersion);
  
  console.log(`\n✅ Version bumped to ${newVersion}`);
  console.log('\nNext steps:');
  console.log('  1. npm run tauri:build');
  console.log('  2. git add -A && git commit -m "chore: bump version to ' + newVersion + '"');
}

main();
