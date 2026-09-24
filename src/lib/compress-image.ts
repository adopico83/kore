export const IMAGE_JPEG_MAX_SIDE = 1600;
export const IMAGE_JPEG_QUALITY = 0.82;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("img"));
    image.src = src;
  });
}

function scaledSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= maxSide && height <= maxSide) return { width, height };
  if (width >= height) {
    return { width: maxSide, height: Math.round((height * maxSide) / width) };
  }
  return { width: Math.round((width * maxSide) / height), height: maxSide };
}

/** Misma compresión que usaba el chat del asistente: lado máximo 1600 px, JPEG 0.82. */
export async function compressImageToJpegBlob(
  file: File,
  options?: { maxSide?: number; quality?: number },
): Promise<Blob> {
  const maxSide = options?.maxSide ?? IMAGE_JPEG_MAX_SIDE;
  const quality = options?.quality ?? IMAGE_JPEG_QUALITY;
  const image = await loadImage(await readAsDataUrl(file));
  const size = scaledSize(image.naturalWidth, image.naturalHeight, maxSide);
  if (size.width <= 0 || size.height <= 0) throw new Error("dims");

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ctx");
  ctx.drawImage(image, 0, 0, size.width, size.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
  });
  if (!blob) throw new Error("blob");
  return blob;
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  return readAsDataUrl(await compressImageToJpegBlob(file));
}
