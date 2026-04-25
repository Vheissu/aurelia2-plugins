import { createFixture } from '@aurelia/testing';
import { AureliaFileUploadConfiguration, IFileUploadService, formatBytes, matchesAccept } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function drop(host: Element, files: File[]): void {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files },
  });
  host.dispatchEvent(event);
}

describe('aurelia2-file-upload', () => {
  test('service validates accept rules and max size', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaFileUploadConfiguration.configure({ maxSize: 10 })]
    );

    await startPromise;

    const service = container.get(IFileUploadService);
    const image = new File(['abc'], 'photo.png', { type: 'image/png' });
    const text = new File(['hello world'], 'notes.txt', { type: 'text/plain' });

    expect(matchesAccept(image, 'image/*,.pdf')).toBe(true);
    expect(matchesAccept(text, 'image/*')).toBe(false);
    expect(formatBytes(2048)).toBe('2 KB');

    const items = service.createItems([image, text], { accept: 'image/*' });
    expect(items[0].status).toBe('accepted');
    expect(items[1].status).toBe('rejected');

    await tearDown();
  });

  test('dropzone accepts dropped files and updates two-way bindings', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-file-upload
        files.two-way="files"
        items.two-way="items"
        accept="image/*"
        file-upload-change.trigger="changed = $event.detail">
      </au-file-upload>`,
      class App {
        public files: File[] = [];
        public items = [];
        public changed = null;
      },
      [AureliaFileUploadConfiguration]
    );

    await startPromise;

    const zone = appHost.querySelector('.au-upload-dropzone') as HTMLElement;
    const image = new File(['abc'], 'photo.png', { type: 'image/png' });
    const text = new File(['abc'], 'notes.txt', { type: 'text/plain' });
    drop(zone, [image, text]);
    await flush();

    expect(component.items.length).toBe(2);
    expect(component.files).toEqual([image]);
    expect(component.items[0].status).toBe('accepted');
    expect(component.items[1].status).toBe('rejected');
    expect(component.changed.length).toBe(2);

    const remove = appHost.querySelector('li button') as HTMLButtonElement;
    remove.click();
    await flush();

    expect(component.items.length).toBe(1);

    await tearDown();
  });

  test('auto upload drives progress and uploaded state', async () => {
    const upload = jest.fn(async (_item, progress) => {
      progress(45);
      return 'https://cdn.example.com/file.png';
    });

    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-file-upload
        items.two-way="items"
        auto-upload.bind="true"
        upload.bind="upload">
      </au-file-upload>`,
      class App {
        public items = [];
        public upload = upload;
      },
      [AureliaFileUploadConfiguration]
    );

    await startPromise;

    const zone = appHost.querySelector('.au-upload-dropzone') as HTMLElement;
    drop(zone, [new File(['abc'], 'photo.png', { type: 'image/png' })]);
    await flush();
    await flush();

    expect(upload).toHaveBeenCalledTimes(1);
    expect(component.items[0].status).toBe('uploaded');
    expect(component.items[0].progress).toBe(100);
    expect(component.items[0].url).toBe('https://cdn.example.com/file.png');

    await tearDown();
  });
});
