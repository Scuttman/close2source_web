#!/usr/bin/env node
/**
 * Migration script: resize existing oversized images in Firebase Storage.
 *
 * This script:
 *  1. Lists all objects in the Firebase Storage bucket.
 *  2. Identifies image files (by content-type) wider than the allowed max.
 *  3. Downloads, resizes (using sharp), re-uploads at the same path, and
 *     deletes the old (overwritten) object — so Firestore download URLs stay valid.
 *
 * Thresholds:
 *   - Banners/covers/backgrounds/gallery → max 1200 px wide
 *   - Thumbnails/avatars/logos/receipts  → max 300 px wide
 *
 * Prerequisites:
 *   npm install firebase-admin sharp
 *   Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service-account key.
 *
 * Usage:
 *   node scripts/resize-existing-images.mjs              # dry-run (default)
 *   node scripts/resize-existing-images.mjs --apply       # actually resize & overwrite
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || 'close2source.firebasestorage.app';

/** Max width for "banner-class" images (covers, gallery, backgrounds, user covers). */
const MAX_BANNER = 1200;

/** Max width for "thumbnail-class" images (avatars, logos, people, receipts, updates). */
const MAX_THUMB = 300;

const DRY_RUN = !process.argv.includes('--apply');

// ─── Classify a storage path into banner or thumbnail ────────────────────────

function maxWidthForPath(filePath) {
  const p = filePath.toLowerCase();

  // Banner-class paths
  if (
    p.includes('/coverphoto')  ||
    p.includes('/cover_')      ||
    p.includes('/covers/')     ||
    p.includes('/background')  ||
    p.includes('/gallery/')
  ) {
    return MAX_BANNER;
  }

  // Thumbnail-class paths
  if (
    p.includes('/people/')      ||
    p.includes('/orglogo')      ||
    p.includes('/logo')         ||
    p.includes('/profile-pics/') ||
    p.includes('/receipts/')    ||
    p.includes('/updates/')     ||
    p.includes('/individuals/')
  ) {
    return MAX_THUMB;
  }

  // Default: treat unknown image paths as banner-class (safer — won't over-compress)
  return MAX_BANNER;
}

function isImageContentType(ct) {
  return ct && ct.startsWith('image/');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Init Firebase Admin
  const app = initializeApp({
    storageBucket: BUCKET_NAME,
  });

  const bucket = getStorage().bucket();

  console.log(`\n📦 Bucket: ${BUCKET_NAME}`);
  console.log(`🔍 Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to execute)' : '🔴 APPLYING CHANGES'}\n`);

  // List all files
  const [files] = await bucket.getFiles();
  console.log(`Found ${files.length} total objects.\n`);

  let scanned = 0;
  let skipped = 0;
  let resized = 0;
  let errors = 0;
  const resizedFiles = [];

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const ct = metadata.contentType || '';

    if (!isImageContentType(ct)) {
      skipped++;
      continue;
    }

    scanned++;
    const maxW = maxWidthForPath(file.name);

    try {
      // Download the image to a buffer
      const [buffer] = await file.download();
      const meta = await sharp(buffer).metadata();

      if (!meta.width || meta.width <= maxW) {
        // Already within limits
        continue;
      }

      const originalWidth = meta.width;
      const originalSize = buffer.length;

      if (DRY_RUN) {
        console.log(`[DRY] ${file.name}  ${originalWidth}px → ${maxW}px  (${(originalSize / 1024).toFixed(0)} KB)`);
        resized++;
        resizedFiles.push({ path: file.name, from: originalWidth, to: maxW, size: originalSize });
        continue;
      }

      // Resize
      const isPng = ct === 'image/png';
      let resizedBuf;
      if (isPng) {
        resizedBuf = await sharp(buffer)
          .resize({ width: maxW, withoutEnlargement: true })
          .png()
          .toBuffer();
      } else {
        resizedBuf = await sharp(buffer)
          .resize({ width: maxW, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      }

      const newCt = isPng ? 'image/png' : 'image/webp';

      // Overwrite the same path so download URLs stay valid
      await file.save(resizedBuf, {
        metadata: {
          contentType: newCt,
          cacheControl: 'public, max-age=31536000',
        },
      });

      console.log(
        `✅ ${file.name}  ${originalWidth}px → ${maxW}px  ` +
        `${(originalSize / 1024).toFixed(0)} KB → ${(resizedBuf.length / 1024).toFixed(0)} KB`
      );
      resized++;
      resizedFiles.push({
        path: file.name,
        from: originalWidth,
        to: maxW,
        oldSize: originalSize,
        newSize: resizedBuf.length,
      });
    } catch (err) {
      console.error(`❌ Error processing ${file.name}: ${err.message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n─── Summary ───');
  console.log(`Images scanned:  ${scanned}`);
  console.log(`Non-images:      ${skipped}`);
  console.log(`Resized:         ${resized}`);
  console.log(`Errors:          ${errors}`);

  if (DRY_RUN && resized > 0) {
    const totalOld = resizedFiles.reduce((s, f) => s + (f.size || f.oldSize || 0), 0);
    console.log(`\nEstimated files to resize: ${resized}`);
    console.log(`Total current size of those files: ${(totalOld / 1024 / 1024).toFixed(1)} MB`);
    console.log('\nRe-run with --apply to execute the resize.\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
