# aurelia2-file-upload

A complete file upload and dropzone component for Aurelia 2. It handles drag/drop, browse input, accept/max-size validation, queue state, progress, remove actions, and optional auto-upload callbacks.

## Install

```bash
npm install aurelia2-file-upload
```

## Register

```ts
import { AureliaFileUploadConfiguration } from 'aurelia2-file-upload';

Aurelia.register(
  AureliaFileUploadConfiguration.configure({
    maxSize: 10 * 1024 * 1024,
  })
);
```

## Usage

```html
<au-file-upload
  files.two-way="files"
  items.two-way="uploadItems"
  accept="image/*,.pdf"
  max-size.bind="5 * 1024 * 1024"
  auto-upload.bind="true"
  upload.bind="uploadFile">
</au-file-upload>
```

```ts
async uploadFile(item, progress) {
  progress(40);
  const url = await this.api.upload(item.file);
  progress(100);
  return url;
}
```

This package targets Aurelia 2 `>=2.0.0-rc.1`.
