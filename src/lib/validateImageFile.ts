// Client-side image validation: MIME, size and dimensions.
// Returns null when valid, or a human-readable error message (i18n strings live in the caller).

export interface ImageValidationOptions {
  allowedTypes?: string[];
  maxSizeBytes?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

const DEFAULTS: Required<Omit<ImageValidationOptions, never>> = {
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  maxSizeBytes: 2 * 1024 * 1024, // 2 MB
  minWidth: 64,
  minHeight: 64,
  maxWidth: 4000,
  maxHeight: 4000,
};

const readDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_DECODE_FAILED'));
    };
    img.src = url;
  });

export async function validateImageFile(
  file: File,
  opts: ImageValidationOptions = {},
): Promise<string | null> {
  const o = { ...DEFAULTS, ...opts };

  if (!o.allowedTypes.includes(file.type)) {
    return `Format no admès (${file.type || 'desconegut'}). Permès: ${o.allowedTypes
      .map((t) => t.replace('image/', '').toUpperCase())
      .join(', ')}.`;
  }
  if (file.size > o.maxSizeBytes) {
    const mb = (o.maxSizeBytes / (1024 * 1024)).toFixed(1);
    return `L'arxiu pesa ${(file.size / (1024 * 1024)).toFixed(2)} MB. Màxim ${mb} MB.`;
  }

  // SVG: skip dimension check (vector).
  if (file.type === 'image/svg+xml') return null;

  try {
    const { width, height } = await readDimensions(file);
    if (width < o.minWidth || height < o.minHeight) {
      return `Imatge massa petita (${width}×${height}). Mínim ${o.minWidth}×${o.minHeight} px.`;
    }
    if (width > o.maxWidth || height > o.maxHeight) {
      return `Imatge massa gran (${width}×${height}). Màxim ${o.maxWidth}×${o.maxHeight} px.`;
    }
  } catch {
    return 'No s\'ha pogut llegir la imatge. Comprova que no estigui corrupta.';
  }

  return null;
}
