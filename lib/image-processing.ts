export interface CompressedImage {
  url: string;
  width: number;
  height: number;
}

/**
 * Resizes and compresses an image File via an offscreen HTMLCanvas, returning
 * its WebP (or JPEG fallback) data URL and resulting pixel dimensions.
 */
export function compressImageWithDimensions(
  file: File,
  maxSize: number,
  quality: number
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error(`Invalid image file: ${file.name}`));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w <= 0 || h <= 0) {
          reject(new Error(`Invalid image dimensions: ${file.name}`));
          return;
        }
        if (w > h) {
          if (w > maxSize) {
            h *= maxSize / w;
            w = maxSize;
          }
        } else if (h > maxSize) {
          w *= maxSize / h;
          h = maxSize;
        }
        const width = Math.max(1, Math.round(w));
        const height = Math.max(1, Math.round(h));
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve({ url: dataUrl, width, height });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressImage(
  file: File,
  maxSize: number,
  quality: number
): Promise<string> {
  const { url } = await compressImageWithDimensions(file, maxSize, quality);
  return url;
}
