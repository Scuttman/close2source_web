/**
 * FTP Deploy Script
 * Uploads deploy.zip to the FTP server root ready for extraction.
 * Credentials: .env.deploy (gitignored)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.deploy') });

const { Client } = require('basic-ftp');

const HOST     = process.env.FTP_HOST;
const PORT     = parseInt(process.env.FTP_PORT || '21', 10);
const USER     = process.env.FTP_USER;
const PASSWORD = process.env.FTP_PASSWORD;
const REMOTE   = (process.env.FTP_REMOTE_DIR || '/').replace(/\/$/, '');
const ROOT     = path.resolve(__dirname, '..');
const ZIP      = path.join(ROOT, 'deploy.zip');

if (!HOST || !USER || !PASSWORD) {
  console.error('Missing FTP credentials. Check .env.deploy');
  process.exit(1);
}
if (!fs.existsSync(ZIP)) {
  console.error('deploy.zip not found. Run "npm run zip" first.');
  process.exit(1);
}

async function deploy() {
  const client = new Client();
  client.ftp.verbose = false;

  const sizeMB = (fs.statSync(ZIP).size / 1024 / 1024).toFixed(1);
  console.log(`\nUploading deploy.zip (${sizeMB} MB) to ${HOST}${REMOTE} ...`);

  client.trackProgress(info => {
    if (info.type === 'upload') {
      const pct = info.bytesOverall && info.bytes
        ? Math.round((info.bytes / info.bytesOverall) * 100)
        : '';
      process.stdout.write(`\r  ${pct ? pct + '%' : ''} ${(info.bytes / 1024 / 1024).toFixed(1)} MB uploaded`.padEnd(40));
    }
  });

  for (const secure of [true, false]) {
    try {
      await client.access({ host: HOST, port: PORT, user: USER, password: PASSWORD,
        secure, secureOptions: { rejectUnauthorized: false } });
      console.log(`Connected (${secure ? 'FTPS' : 'plain FTP'}).`);
      break;
    } catch (e) {
      if (secure) console.warn('FTPS failed, retrying plain FTP...');
      else { console.error('Could not connect:', e.message); client.close(); process.exit(1); }
    }
  }

  try {
    await client.cd(REMOTE);
    await client.uploadFrom(ZIP, 'deploy.zip');
    console.log(`\n\nDone! deploy.zip uploaded to ${HOST}${REMOTE}/deploy.zip`);
    console.log('\nNext steps in cPanel File Manager:');
    console.log('  1. Navigate to ' + REMOTE);
    console.log('  2. Select deploy.zip and click Extract');
    console.log('  3. Setup Node.js App -> Run NPM Install -> Restart');
  } catch (err) {
    console.error('\nUpload failed:', err.message);
    client.close();
    process.exit(1);
  }

  client.close();
}

deploy();
