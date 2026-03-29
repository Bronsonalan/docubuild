import path from "path";

export type MediaKind = "uploads" | "renders";

const DATA_DIR = path.join(process.cwd(), ".data");
const MEDIA_DIR = path.join(DATA_DIR, "media");
const PUBLIC_DIR = path.join(process.cwd(), "public");

export const UPLOADS_DIR = path.join(MEDIA_DIR, "uploads");
export const RENDERS_DIR = path.join(MEDIA_DIR, "renders");

const MIME_TYPES: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".webm": "video/webm",
};

function assertSafeFileName(fileName: string): string {
  const normalized = path.basename(fileName);
  if (normalized !== fileName) {
    throw new Error(`Invalid media filename: ${fileName}`);
  }

  return normalized;
}

export function getMediaPath(kind: MediaKind, fileName: string): string {
  const safeFileName = assertSafeFileName(fileName);
  return path.join(kind === "uploads" ? UPLOADS_DIR : RENDERS_DIR, safeFileName);
}

export function getUploadUrl(fileName: string): string {
  return `/media/uploads/${assertSafeFileName(fileName)}`;
}

export function getRenderUrl(fileName: string): string {
  return `/media/renders/${assertSafeFileName(fileName)}`;
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export function resolveStoredFilePath(mediaUrl: string): string {
  const cleanUrl = mediaUrl.split("?")[0];

  if (cleanUrl.startsWith("/media/uploads/")) {
    return getMediaPath("uploads", cleanUrl.slice("/media/uploads/".length));
  }

  if (cleanUrl.startsWith("/media/renders/")) {
    return getMediaPath("renders", cleanUrl.slice("/media/renders/".length));
  }

  // Legacy fallback for projects created before media moved out of `public/`.
  if (cleanUrl.startsWith("/uploads/") || cleanUrl.startsWith("/renders/")) {
    return path.join(PUBLIC_DIR, cleanUrl.slice(1));
  }

  throw new Error(`Unsupported media URL: ${mediaUrl}`);
}
