// Client-side image optimization: resizes and re-encodes images before upload
// to keep storage light and the storefront fast, without visible quality loss.

export interface OptimizeOptions {
  /** Max width or height in pixels. Larger images are downscaled keeping aspect ratio. */
  maxDimension?: number;
  /** WebP quality 0–1. */
  quality?: number;
  /** Output mime type. Defaults to image/webp. */
  mimeType?: "image/webp" | "image/jpeg";
}

const DEFAULTS: Required<OptimizeOptions> = {
  maxDimension: 1600,
  quality: 0.85,
  mimeType: "image/webp",
};

/** Returns true for raster formats we can safely re-encode in canvas. */
function isOptimizable(file: File) {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/**
 * Optimize an image File for web delivery.
 * - Downscales when larger than `maxDimension`.
 * - Re-encodes to WebP (smaller than JPEG/PNG at similar quality).
 * - SVG and other vector / unknown types are returned unchanged.
 * - If the optimized output is bigger than the original (rare for already small/optimized files),
 *   the original is returned to avoid making things worse.
 */
export async function optimizeImage(
  file: File,
  options: OptimizeOptions = {},
): Promise<File> {
  if (!isOptimizable(file)) return file;
  const opts = { ...DEFAULTS, ...options };

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return file;
  }

  const srcW = (bitmap as ImageBitmap).width ?? (bitmap as HTMLImageElement).naturalWidth;
  const srcH = (bitmap as ImageBitmap).height ?? (bitmap as HTMLImageElement).naturalHeight;
  if (!srcW || !srcH) return file;

  const scale = Math.min(1, opts.maxDimension / Math.max(srcW, srcH));
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, dstW, dstH);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, opts.mimeType, opts.quality),
  );
  if (!blob) return file;

  // Don't replace a smaller original with a larger optimized version.
  if (blob.size >= file.size && scale === 1) return file;

  const ext = opts.mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${ext}`, {
    type: opts.mimeType,
    lastModified: Date.now(),
  });
}
