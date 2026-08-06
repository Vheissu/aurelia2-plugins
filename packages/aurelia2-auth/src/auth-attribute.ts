import { IEventAggregator, type IDisposable, resolve } from '@aurelia/kernel';
import { bindable, customAttribute, INode } from 'aurelia';
import type { IAuthorizationRequirement } from './configuration';
import { IAuthorizationService } from './authorization';
import { AuthEvents } from './auth-events';

@customAttribute('auth')
export class AuthCustomAttribute {
  @bindable public value: IAuthorizationRequirement = { authenticated: true };
  @bindable public mode: 'hide' | 'disable' = 'hide';
  private readonly element = resolve(INode) as HTMLElement;
  private readonly authorization = resolve(IAuthorizationService);
  private readonly events = resolve(IEventAggregator);
  private subscription: IDisposable | null = null;
  private updateVersion = 0;
  private initiallyHidden = false;
  private initiallyDisabled = false;

  public binding(): void {
    this.initiallyHidden = Boolean(this.element.hidden);
    this.initiallyDisabled = isDisableable(this.element) && this.element.disabled;
    void this.update();
    this.subscription = this.events.subscribe(AuthEvents.stateChanged, () => void this.update());
  }

  public unbinding(): void {
    this.updateVersion++;
    this.subscription?.dispose();
    this.subscription = null;
    this.restore();
  }

  public valueChanged(): void {
    void this.update();
  }

  public modeChanged(): void {
    void this.update();
  }

  private async update(): Promise<void> {
    const version = ++this.updateVersion;
    const decision = await this.authorization.evaluate(this.value ?? { authenticated: true });
    if (version !== this.updateVersion) return;
    this.apply(decision.allowed);
  }

  private apply(allowed: boolean): void {
    this.restore();
    if (this.mode === 'disable') {
      if (isDisableable(this.element)) this.element.disabled = this.initiallyDisabled || !allowed;
      if (!allowed) this.element.setAttribute('aria-disabled', 'true');
      return;
    }
    this.element.hidden = this.initiallyHidden || !allowed;
    if (!allowed) this.element.setAttribute('aria-hidden', 'true');
  }

  private restore(): void {
    this.element.hidden = this.initiallyHidden;
    this.element.removeAttribute('aria-hidden');
    this.element.removeAttribute('aria-disabled');
    if (isDisableable(this.element)) this.element.disabled = this.initiallyDisabled;
  }
}

function isDisableable(element: HTMLElement): element is HTMLElement & { disabled: boolean } {
  return 'disabled' in element;
}
