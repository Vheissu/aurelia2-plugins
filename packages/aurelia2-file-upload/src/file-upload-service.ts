import { DI } from 'aurelia';
import type { FileUploadConfigurationOptions, FileUploadItem, FileUploadValidationOptions } from './types';

export class FileUploadService {
  private options: Required<FileUploadConfigurationOptions> = {
    maxSize: Number.POSITIVE_INFINITY,
    maxFiles: Number.POSITIVE_INFINITY,
  };

  public configure(options: FileUploadConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public createItems(files: File[] | FileList, options: FileUploadValidationOptions = {}): FileUploadItem[] {
    const list = Array.from(files);
    const maxFiles = options.multiple === false ? 1 : options.maxFiles ?? this.options.maxFiles;

    return list.slice(0, maxFiles).map((file) => this.createItem(file, options));
  }

  public createItem(file: File, options: FileUploadValidationOptions = {}): FileUploadItem {
    const error = this.validate(file, options);
    return {
      id: createId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: error ? 'rejected' : 'accepted',
      progress: 0,
      error,
    };
  }

  public validate(file: File, options: FileUploadValidationOptions = {}): string | undefined {
    const maxSize = options.maxSize ?? this.options.maxSize;
    if (Number.isFinite(maxSize) && file.size > maxSize) {
      return `File is larger than ${formatBytes(maxSize)}.`;
    }

    if (options.accept && !matchesAccept(file, options.accept)) {
      return `File type is not allowed.`;
    }

    return undefined;
  }
}

export const IFileUploadService = DI.createInterface<IFileUploadService>('IFileUploadService', x => x.singleton(FileUploadService));
export interface IFileUploadService extends FileUploadService {}

export function matchesAccept(file: File, accept: string): boolean {
  const rules = accept.split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  if (rules.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith('.')) return fileName.endsWith(rule);
    if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1));
    return fileType === rule;
  });
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
}

function createId(): string {
  return `file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
