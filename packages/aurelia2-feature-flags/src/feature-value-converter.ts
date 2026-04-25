import { resolve, valueConverter } from 'aurelia';
import { IFeatureFlags } from './feature-flags-service';
import type { FeatureFlagContext } from './types';

@valueConverter('feature')
export class FeatureValueConverter {
  private readonly flags = resolve(IFeatureFlags);

  public toView(key: string, context?: FeatureFlagContext): boolean {
    return this.flags.isEnabled(key, context);
  }
}
