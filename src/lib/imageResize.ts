/**
 * Shared client-side image resize utility.
 *
 * Usage:
 *   import { resizeImageFile } from '@/src/lib/imageResize';
 *
 *   // Banner / cover photo → max 1200px wide
 *   const resized = await resizeImageFile(file, 1200);
 *
 *   // Thumbnail / avatar / logo → max 300px wide
 *   const resized = await resizeImageFile(file, 300);
 */

/** Preset max-width constants so callers don't need magic numbers. */
export const IMAGE_MAX_BANNER = 1200;
export const IMAGE_MAX_THUMB  = 300;

/**
 * Resize an image `File` so its width does not exceed `maxWidth`.
 *
 * - If the image is already within range it is returned unchanged.
 * - Non-image files are returned unchanged.
 * - Output format is **webp** at quality 0.85 for best size/quality trade-off
 *   (PNGs stay as PNG to preserve transparency).
 * - The returned `File` keeps the original name (extension may differ).
 */
export async function resizeImageFile(
  file: File,
  maxWidth: number,
): Promise<File> {
  // Skip non-image files
  if (!/^image\//.test(file.type)) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        if (img.width <= maxWidth) {
          URL.revokeObjectURL(url);
          return resolve(file);
        }

        const scale = maxWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Keep PNG for transparency, otherwise use webp for smaller files
        const isPng = file.type === 'image/png';
        const outType = isPng ? 'image/png' : 'image/webp';
        const quality = isPng ? undefined : 0.85;

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(new File([blob], file.name, { type: outType }));
            } else {
              resolve(file);
            }
          },
          outType,
          quality,
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Convenience: resize and return as a Blob (for callers that use uploadBytes
 * instead of uploadBytesResumable).
 */
export async function resizeImageBlob(
  file: File,
  maxWidth: number,
): Promise<Blob> {
  const resized = await resizeImageFile(file, maxWidth);
  return resized as Blob;
}
