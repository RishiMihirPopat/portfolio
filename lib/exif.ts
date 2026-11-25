import exifr from 'exifr';

export interface PhotoExifMetadata {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  takenAt?: string;
  location?: string;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\0/g, '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatCameraName(makeRaw: unknown, modelRaw: unknown): string | undefined {
  const make = cleanString(makeRaw);
  const model = cleanString(modelRaw);
  if (!make && !model) return undefined;
  if (!make) return model;
  if (!model) return make;

  // Avoid duplicating brand name when Model already starts with Make (e.g., "NIKON Z 6" or "Canon EOS R6")
  const makeFirstWord = make.split(/\s+/)[0].toLowerCase();
  if (model.toLowerCase().startsWith(make.toLowerCase()) || model.toLowerCase().startsWith(makeFirstWord)) {
    return model;
  }
  return `${make} ${model}`;
}

function formatShutterSpeed(exposureTime: unknown): string | undefined {
  if (typeof exposureTime !== 'number' || !Number.isFinite(exposureTime) || exposureTime <= 0) {
    return undefined;
  }
  if (exposureTime >= 1) {
    const rounded = Math.round(exposureTime * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}s`;
  }
  const denom = Math.round(1 / exposureTime);
  if (denom <= 1) return '1s';
  return `1/${denom}s`;
}

function formatAperture(fNumber: unknown): string | undefined {
  if (typeof fNumber !== 'number' || !Number.isFinite(fNumber) || fNumber <= 0) {
    return undefined;
  }
  const rounded = Math.round(fNumber * 10) / 10;
  return `f/${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

function formatFocalLength(focal: unknown): string | undefined {
  if (typeof focal !== 'number' || !Number.isFinite(focal) || focal <= 0) {
    return undefined;
  }
  const rounded = Math.round(focal * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}mm`;
}

function formatIso(isoRaw: unknown): string | undefined {
  const num = Array.isArray(isoRaw) ? isoRaw[0] : isoRaw;
  if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) {
    return undefined;
  }
  return `ISO ${Math.round(num)}`;
}

function formatTakenAt(dateRaw: unknown): string | undefined {
  if (dateRaw instanceof Date && !Number.isNaN(dateRaw.getTime())) {
    return dateRaw.toISOString();
  }
  if (typeof dateRaw === 'string') {
    const parsed = new Date(dateRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

/**
 * Extracts camera & exposure EXIF metadata from an image File before canvas compression.
 * Gracefully returns `{}` if the file has no EXIF or is an unsupported format.
 */
export async function extractPhotoExif(file: File): Promise<PhotoExifMetadata> {
  try {
    const data = await exifr.parse(file, {
      pick: [
        'Make',
        'Model',
        'LensModel',
        'LensInfo',
        'FocalLength',
        'FocalLengthIn35mmFormat',
        'FNumber',
        'ExposureTime',
        'ISO',
        'DateTimeOriginal',
        'CreateDate',
      ],
    });

    if (!data || typeof data !== 'object') return {};

    const camera = formatCameraName(data.Make, data.Model);
    const lens = cleanString(data.LensModel);
    const focalLength =
      formatFocalLength(data.FocalLengthIn35mmFormat) ??
      formatFocalLength(data.FocalLength);
    const aperture = formatAperture(data.FNumber);
    const shutterSpeed = formatShutterSpeed(data.ExposureTime);
    const iso = formatIso(data.ISO);
    const takenAt =
      formatTakenAt(data.DateTimeOriginal) ?? formatTakenAt(data.CreateDate);

    const result: PhotoExifMetadata = {};
    if (camera) result.camera = camera;
    if (lens) result.lens = lens;
    if (focalLength) result.focalLength = focalLength;
    if (aperture) result.aperture = aperture;
    if (shutterSpeed) result.shutterSpeed = shutterSpeed;
    if (iso) result.iso = iso;
    if (takenAt) result.takenAt = takenAt;
    return result;
  } catch {
    return {};
  }
}

export function formatExposureSummary(meta: Pick<PhotoExifMetadata, 'focalLength' | 'aperture' | 'shutterSpeed' | 'iso'>): string | null {
  const parts = [meta.focalLength, meta.aperture, meta.shutterSpeed, meta.iso]
    .map((v) => v?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
