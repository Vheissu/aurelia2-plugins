import { IContainer, IRegistry, Registration } from 'aurelia';
import { FeatureEnabledCustomAttribute } from './feature-enabled';
import { FeatureFlagsService, IFeatureFlags } from './feature-flags-service';
import { FeatureValueConverter } from './feature-value-converter';
import type { FeatureFlagsConfigurationOptions } from './types';

const DefaultResources: IRegistry[] = [
  FeatureEnabledCustomAttribute as unknown as IRegistry,
  FeatureValueConverter as unknown as IRegistry,
];

function createConfiguration(options: FeatureFlagsConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IFeatureFlags) as FeatureFlagsService;
      service.configure(options);

      return container.register(
        Registration.instance(IFeatureFlags, service),
        Registration.instance(FeatureFlagsService, service),
        ...DefaultResources
      );
    },
    configure(newOptions: FeatureFlagsConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaFeatureFlagsConfiguration = createConfiguration();

export * from './types';
export * from './feature-flags-service';
export * from './feature-enabled';
export * from './feature-value-converter';
