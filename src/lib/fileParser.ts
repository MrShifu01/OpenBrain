/**
 * File parsing utilities for OpenBrain file upload.
 * Supports: .txt, .md, .csv (text), .pdf, .docx (binary → base64 for AI extraction)
 */

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.csv', '.pdf', '.docx'] as const;

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv']);

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}

export function isSupportedFile(file: File): boolean {
  return SUPPORTED_EXTENSIONS.includes(getFileExtension(file.name) as any);
}

export function isTextFile(file: File): boolean {
  return TEXT_EXTENSIONS.has(getFileExtension(file.name));
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
