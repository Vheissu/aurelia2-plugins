import { IEventAggregator, type IDisposable, resolve } from '@aurelia/kernel';
import { bindable, customAttribute, INode } from 'aurelia';
import { IAuthentication } from './authentication';
import { AuthEvents } from './auth-events';

@customAttribute('if-authenticated')
export class IfAuthenticatedCustomAttribute {
  @bindable public value: boolean | string = true;
  private readonly element = resolve(INode) as HTMLElement;
  private readonly auth = resolve(IAuthentication);
  private readonly events = resolve(IEventAggregator);
  private subscription: IDisposable | null = null;
  private initiallyHidden = false;

  public binding(): void {
    this.initiallyHidden = Boolean(this.element.hidden);
    this.update();
    this.subscription = this.events.subscribe(AuthEvents.stateChanged, () => this.update());
  }

  public unbinding(): void {
    this.subscription?.dispose();
    this.subscription = null;
    this.element.hidden = this.initiallyHidden;
    this.element.removeAttribute('aria-hidden');
  }

  public valueChanged(): void {
    this.update();
  }

  private update(): void {
    const showAuthenticated = this.value !== false && this.value !== 'false';
    const visible = showAuthenticated ? this.auth.isAuthenticated() : !this.auth.isAuthenticated();
    this.element.hidden = this.initiallyHidden || !visible;
    if (!visible) this.element.setAttribute('aria-hidden', 'true');
    else this.element.removeAttribute('aria-hidden');
  }
}
