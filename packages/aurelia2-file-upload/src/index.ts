import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuFileUploadCustomElement } from './au-file-upload';
import { FileUploadService, IFileUploadService } from './file-upload-service';
import type { FileUploadConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuFileUploadCustomElement as unknown as IRegistry,
];

function createConfiguration(options: FileUploadConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IFileUploadService) as FileUploadService;
      service.configure(options);

      return container.register(
        Registration.instance(IFileUploadService, service),
        Registration.instance(FileUploadService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: FileUploadConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaFileUploadConfiguration = createConfiguration();

export * from './types';
export * from './file-upload-service';
export * from './au-file-upload';
