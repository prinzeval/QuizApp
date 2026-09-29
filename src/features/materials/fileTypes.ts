import type { FileRejection } from "@mantine/dropzone";
import { IconFileText, IconFileTypeDocx, IconFileTypePdf, IconPhoto, IconPresentation, type Icon } from "@tabler/icons-react";
import type { Material, MaterialKind } from "../../lib/learningApi.ts";

/** Server limits (see the backend's materialsUpload middleware). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 10;

/** What the dropzone and file picker accept. The server re-checks every file by its bytes. */
export const ACCEPT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "text/plain": [".txt"],
  "text/markdown": [".md", ".markdown"],
};

export const ACCEPT_HINT = "PDF, Word, PowerPoint, images (JPEG, PNG, WebP) or text files. Up to 10 files, 50 MB each.";

export const KIND: Record<MaterialKind, { label: string; icon: Icon; color: string }> = {
  pdf: { label: "PDF", icon: IconFileTypePdf, color: "red" },
  docx: { label: "Word document", icon: IconFileTypeDocx, color: "blue" },
  pptx: { label: "Slides", icon: IconPresentation, color: "orange" },
  image: { label: "Image", icon: IconPhoto, color: "teal" },
  text: { label: "Text", icon: IconFileText, color: "gray" },
};

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/markdown": "md",
};

/** A sensible filename for downloading the original: "Heart lecture.pdf". */
export function downloadName(material: Pick<Material, "title" | "mimeType" | "kind">): string {
  const extension = EXTENSIONS[material.mimeType] ?? (material.kind === "image" ? "jpg" : material.kind === "text" ? "txt" : material.kind);
  return material.title.toLowerCase().endsWith(`.${extension}`) ? material.title : `${material.title}.${extension}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Plain-language reasons for files the dropzone turned away, one line per file. */
export function describeRejections(rejections: FileRejection[]): string[] {
  if (rejections.some(r => r.errors.some(e => e.code === "too-many-files"))) {
    return [`You can upload up to ${MAX_FILES} files at a time. Try again with fewer files.`];
  }
  return rejections.map(({ file, errors }) => {
    const codes = errors.map(e => e.code);
    if (codes.includes("file-too-large")) return `"${file.name}" is ${formatBytes(file.size)}. Files can be at most 50 MB.`;
    if (codes.includes("file-invalid-type")) return `"${file.name}" isn't a supported file type.`;
    return `"${file.name}": ${errors[0]?.message ?? "couldn't be added."}`;
  });
}
