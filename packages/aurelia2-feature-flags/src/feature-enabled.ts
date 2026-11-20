import { bindable, customAttribute, INode, resolve } from 'aurelia';
import { IFeatureFlags } from './feature-flags-service';
import type { FeatureFlagContext, FeatureFlagDispose } from './types';

const identity = <T>(value: T): T => value;

@customAttribute({ name: 'feature-enabled', defaultProperty: 'value' })
export class FeatureEnabledCustomAttribute {
  @bindable public value = '';
  @bindable({ set: identity }) public context: FeatureFlagContext | null = null;
  @bindable public remove = false;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly flags = resolve(IFeatureFlags);
  private subscription: FeatureFlagDispose | null = null;
  private placeholder: Comment | null = null;
  private previousVisibility?: { hidden: HTMLElement['hidden']; ariaHidden: string | null };

  public attached(): void {
    this.subscription = this.flags.onChange(() => this.apply());
    this.apply();
  }

  public detaching(): void {
    this.subscription?.dispose();
    this.subscription = null;
    this.restorePresence();
    this.restoreVisibility();
  }

  public valueChanged(): void {
    this.apply();
  }

  public contextChanged(): void {
    this.apply();
  }

  public removeChanged(): void {
    this.apply();
  }

  private apply(): void {
    if (!this.subscription) return;
    const enabled = this.flags.isEnabled(this.value, this.context ?? undefined);
    if (this.remove) {
      this.restoreVisibility();
      this.togglePresence(enabled);
      return;
    }

    this.restorePresence();
    this.previousVisibility ??= {
      hidden: this.element.hidden,
      ariaHidden: this.element.getAttribute('aria-hidden'),
    };
    this.element.hidden = !enabled;
    this.element.setAttribute('aria-hidden', String(!enabled));
  }

  private togglePresence(enabled: boolean): void {
    if (enabled) {
      this.restorePresence();
      return;
    }

    if (!this.placeholder) {
      this.placeholder = this.element.ownerDocument.createComment(`feature-enabled:${this.value}`);
    }
    if (this.element.parentNode) {
      this.element.parentNode.insertBefore(this.placeholder, this.element);
      this.element.remove();
    }
  }

  private restorePresence(): void {
    if (this.placeholder?.parentNode) {
      this.placeholder.parentNode.insertBefore(this.element, this.placeholder);
      this.placeholder.remove();
    }
  }

  private restoreVisibility(): void {
    const previous = this.previousVisibility;
    if (!previous) return;
    this.element.hidden = previous.hidden;
    if (previous.ariaHidden === null) {
      this.element.removeAttribute('aria-hidden');
    } else {
      this.element.setAttribute('aria-hidden', previous.ariaHidden);
    }
    this.previousVisibility = undefined;
  }
}
