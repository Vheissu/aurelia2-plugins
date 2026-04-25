export type FileUploadStatus = 'queued' | 'accepted' | 'rejected' | 'uploading' | 'uploaded' | 'error';

export interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: FileUploadStatus;
  progress: number;
  error?: string;
  url?: string;
}

export interface FileUploadValidationOptions {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
}

export type FileUploadProgress = (progress: number) => void;
export type FileUploadHandler = (item: FileUploadItem, progress: FileUploadProgress) => Promise<string | void> | string | void;

export interface FileUploadConfigurationOptions {
  maxSize?: number;
  maxFiles?: number;
}
