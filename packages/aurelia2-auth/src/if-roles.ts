import { IEventAggregator, type IDisposable, resolve } from '@aurelia/kernel';
import { bindable, customAttribute, INode } from 'aurelia';
import { IAuthorizationService } from './authorization';
import { AuthEvents } from './auth-events';

@customAttribute('if-roles')
export class IfRolesCustomAttribute {
  @bindable public value: string | readonly string[] = [];
  @bindable public mode: 'any' | 'all' = 'any';
  private readonly element = resolve(INode) as HTMLElement;
  private readonly authorization = resolve(IAuthorizationService);
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

  public modeChanged(): void {
    this.update();
  }

  private update(): void {
    const roles = normalize(this.value);
    const visible = roles.length === 0 || (this.mode === 'all'
      ? this.authorization.hasAllRoles(roles)
      : this.authorization.hasAnyRole(roles));
    this.element.hidden = this.initiallyHidden || !visible;
    if (!visible) this.element.setAttribute('aria-hidden', 'true');
    else this.element.removeAttribute('aria-hidden');
  }
}

function normalize(value: string | readonly string[]): readonly string[] {
  return typeof value === 'string'
    ? value.split(',').map(entry => entry.trim()).filter(Boolean)
    : value;
}
