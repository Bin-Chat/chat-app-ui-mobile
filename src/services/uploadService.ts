import authorizedAxios from '@/api/authorizedAxios';
import * as FileSystem from 'expo-file-system/legacy';

<<<<<<< HEAD
export type FileCategory = 'image' | 'video' | 'file' | 'audio';
=======
export type FileCategory = 'image' | 'video' | 'file' | 'voice';
>>>>>>> 0343b781c54fd18b5c4e92b0d6299692dcfb12af

export interface UploadedAttachment {
  url: string;
  type: FileCategory;
  filename: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  duration?: number;
}

export const FILE_SIZE_LIMITS: Record<FileCategory, number> = {
<<<<<<< HEAD
  image: 10 * 1024 * 1024, // 10 MB
  video: 50 * 1024 * 1024, // 50 MB
  file: 20 * 1024 * 1024, // 20 MB (backend document limit)
  audio: 10 * 1024 * 1024, // 10 MB
=======
  image: 10 * 1024 * 1024,  // 10 MB
  video: 50 * 1024 * 1024,  // 50 MB
  file: 20 * 1024 * 1024,   // 20 MB
  voice: 10 * 1024 * 1024,  // 10 MB
>>>>>>> 0343b781c54fd18b5c4e92b0d6299692dcfb12af
};

/** Attachment type used in message bubbles (mobile-facing) */
export function getCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
<<<<<<< HEAD
  if (mimeType.startsWith('audio/')) return 'audio';
=======
  if (mimeType.startsWith('audio/')) return 'voice';
>>>>>>> 0343b781c54fd18b5c4e92b0d6299692dcfb12af
  return 'file';
}

/** Upload category expected by the backend API */
<<<<<<< HEAD
function getUploadCategory(mimeType: string): 'image' | 'video' | 'document' | 'audio' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
=======
function getUploadCategory(mimeType: string): 'image' | 'video' | 'document' | 'voice' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'voice';
>>>>>>> 0343b781c54fd18b5c4e92b0d6299692dcfb12af
  return 'document';
}

function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot >= 0 ? filename.slice(lastDot) : '';
  const base = filename.slice(0, lastDot >= 0 ? lastDot : filename.length);
  const safeBase = base.replace(/[^\w\-. ]/g, '_').replace(/_+/g, '_');
  return (safeBase || 'file') + ext;
}

interface PresignResponse {
  presignedUrl: string;
  objectKey: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

interface FinalizeResponse {
  objectKey: string;
  cdnUrl: string;
  category: string;
  size: number;
  contentType: string;
}

/**
 * Upload a local file URI to S3 via presigned URL + finalize.
 * Returns the CDN URL and attachment metadata.
 */
export async function uploadFile(
  uri: string,
  filename: string,
  mimeType: string,
  size: number,
  onProgress?: (pct: number) => void
): Promise<UploadedAttachment> {
  const uploadCategory = getUploadCategory(mimeType);
  const attachmentType = getCategory(mimeType);
  const safeFilename = sanitizeFilename(filename);

  // 1. Get presigned PUT URL from backend
  const { data } = await authorizedAxios.post<PresignResponse>('/api/uploads/presign', {
    filename: safeFilename,
    mimeType,
    fileSize: size,
    category: uploadCategory,
  });

  // 2. Upload file directly to S3 via presigned URL
  const uploadResult = await FileSystem.uploadAsync(data.presignedUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': mimeType },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`S3 upload failed: HTTP ${uploadResult.status}`);
  }

  // 3. Finalize: confirm upload and get CDN URL
  const { data: finalizeData } = await authorizedAxios.post<FinalizeResponse>(
    '/api/uploads/finalize',
    {
      objectKey: data.objectKey,
      category: uploadCategory,
    }
  );

  if (onProgress) onProgress(100);

  return {
    url: finalizeData.cdnUrl,
    type: attachmentType,
    filename,
    size: finalizeData.size || size,
    mimeType,
  };
}
