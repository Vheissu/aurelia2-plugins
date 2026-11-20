import { bindable, BindingMode, customElement, resolve } from 'aurelia';
import { IFileUploadService, formatBytes } from './file-upload-service';
import type { FileUploadHandler, FileUploadItem } from './types';
import template from './au-file-upload.html';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-file-upload',
  template,
})
export class AuFileUploadCustomElement {
  @bindable({ mode: BindingMode.twoWay, set: identity }) public files: File[] = [];
  @bindable({ mode: BindingMode.twoWay, set: identity }) public items: FileUploadItem[] = [];
  @bindable public accept = '';
  @bindable public multiple = true;
  @bindable public maxSize: number | null = null;
  @bindable public maxFiles: number | null = null;
  @bindable public autoUpload = false;
  @bindable public disabled = false;
  @bindable public dropText = 'Drop files here';
  @bindable public browseText = 'Browse files';
  @bindable({ set: identity }) public upload: FileUploadHandler | null = null;

  public fileInput!: HTMLInputElement;
  public dragging = false;

  private readonly uploads = resolve(IFileUploadService);

  public browse(): void {
    if (this.disabled) return;
    this.fileInput?.click();
  }

  public onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(input.files);
      input.value = '';
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging = !this.disabled;
  }

  public onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
    if (event.dataTransfer?.files) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  public addFiles(files: File[] | FileList): void {
    if (this.disabled) return;
    const created = this.uploads.createItems(files, {
      accept: this.accept,
      maxSize: this.maxSize ?? undefined,
      maxFiles: this.maxFiles ?? undefined,
      multiple: this.multiple,
    }, this.items.length);
    if (created.length === 0) return;

    this.items = this.multiple ? [...this.items, ...created] : created;
    this.syncFiles();

    this.dispatch('file-upload-change', this.items);

    if (this.autoUpload && this.upload) {
      for (const item of created.filter((entry) => entry.status === 'accepted')) {
        void this.uploadItem(item);
      }
    }
  }

  public remove(item: FileUploadItem): void {
    if (this.disabled || !this.items.includes(item)) return;
    this.items = this.items.filter((entry) => entry !== item);
    this.syncFiles();
    this.dispatch('file-upload-remove', item);
    this.dispatch('file-upload-change', this.items);
  }

  public formatSize(size: number): string {
    return formatBytes(size);
  }

  private async uploadItem(item: FileUploadItem): Promise<void> {
    if (!this.upload || !this.items.includes(item)) return;

    item.status = 'uploading';
    item.progress = 0;
    this.items = [...this.items];

    try {
      const url = await this.upload(item, (progress) => {
        if (item.status !== 'uploading' || !this.items.includes(item)) return;
        item.progress = Math.max(0, Math.min(100, progress));
        this.items = [...this.items];
      });
      if (!this.items.includes(item)) return;
      item.status = 'uploaded';
      item.progress = 100;
      if (url) item.url = url;
      this.dispatch('file-upload-success', item);
    } catch (error) {
      if (!this.items.includes(item)) return;
      item.status = 'error';
      item.error = error instanceof Error ? error.message : String(error);
      this.dispatch('file-upload-error', item);
    }

    this.items = [...this.items];
  }

  private syncFiles(): void {
    this.files = this.items.filter((item) => item.status !== 'rejected').map((item) => item.file);
  }

  private dispatch(name: string, detail: unknown): void {
    this.fileInput?.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail,
    }));
  }
}
