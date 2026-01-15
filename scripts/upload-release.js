#!/usr/bin/env node
/**
 * Auto Upload Release to Web Server
 * Uploads the built installer to your web server after build
 * 
 * Usage: 
 *   npm run release:upload
 *   node scripts/upload-release.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BUNDLE_DIR = path.join(ROOT, 'src-tauri', 'target', 'release', 'bundle');

// Configuration - Update these values
const CONFIG = {
  // Your web server API endpoint for uploading releases
  uploadUrl: process.env.RELEASE_UPLOAD_URL || 'https://mun-ai.art/api/admin/releases',
  // Admin session cookie or API key
  authToken: process.env.RELEASE_AUTH_TOKEN || '',
};

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function findInstallerFile() {
  const version = getVersion();
  
  // Look for NSIS installer first (preferred for Windows)
  const nsisDir = path.join(BUNDLE_DIR, 'nsis');
  if (fs.existsSync(nsisDir)) {
    const files = fs.readdirSync(nsisDir).filter(f => f.endsWith('.exe'));
    if (files.length > 0) {
      return {
        path: path.join(nsisDir, files[0]),
        name: files[0],
        type: 'nsis'
      };
    }
  }
  
  // Fall back to MSI
  const msiDir = path.join(BUNDLE_DIR, 'msi');
  if (fs.existsSync(msiDir)) {
    const files = fs.readdirSync(msiDir).filter(f => f.endsWith('.msi'));
    if (files.length > 0) {
      return {
        path: path.join(msiDir, files[0]),
        name: files[0],
        type: 'msi'
      };
    }
  }
  
  return null;
}

async function uploadFile(filePath, fileName, version) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(filePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: application/octet-stream',
      '',
      fileBuffer.toString('binary'),
      `--${boundary}`,
      `Content-Disposition: form-data; name="version"`,
      '',
      version,
      `--${boundary}`,
      `Content-Disposition: form-data; name="changelog"`,
      '',
      `Version ${version} release`,
      `--${boundary}`,
      `Content-Disposition: form-data; name="setAsLatest"`,
      '',
      'true',
      `--${boundary}--`
    ].join('\r\n');
    
    const url = new URL(CONFIG.uploadUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData, 'binary'),
        'Cookie': CONFIG.authToken ? `admin_session=${CONFIG.authToken}` : '',
      }
    };
    
    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(formData, 'binary');
    req.end();
  });
}

async function main() {
  console.log('\n📦 Finding installer file...\n');
  
  const installer = findInstallerFile();
  
  if (!installer) {
    console.error('❌ No installer found. Run "npm run tauri:build" first.');
    process.exit(1);
  }
  
  const version = getVersion();
  const fileSize = fs.statSync(installer.path).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  
  console.log(`Found: ${installer.name}`);
  console.log(`Version: ${version}`);
  console.log(`Size: ${fileSizeMB} MB`);
  console.log(`Type: ${installer.type.toUpperCase()}`);
  
  if (!CONFIG.uploadUrl || CONFIG.uploadUrl.includes('your-server')) {
    console.log('\n⚠️  Upload URL not configured.');
    console.log('Set RELEASE_UPLOAD_URL environment variable or update CONFIG in this script.');
    console.log('\nManual upload path:', installer.path);
    return;
  }
  
  if (!CONFIG.authToken) {
    console.log('\n⚠️  Auth token not configured.');
    console.log('Set RELEASE_AUTH_TOKEN environment variable.');
    console.log('\nManual upload path:', installer.path);
    return;
  }
  
  console.log('\n📤 Uploading to server...\n');
  
  try {
    const result = await uploadFile(installer.path, installer.name, version);
    console.log('✅ Upload successful!');
    console.log('Download URL:', result.downloadUrl || result.url);
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    console.log('\nManual upload path:', installer.path);
    process.exit(1);
  }
}

main();
