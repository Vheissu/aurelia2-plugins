import { customAttribute, INode, bindable, resolve } from 'aurelia';
import { IAuthService } from './auth-service';
import { IEventAggregator, IDisposable } from '@aurelia/kernel';
import { AuthEvents } from './auth-events';

@customAttribute('if-roles')
export class IfRolesCustomAttribute {
  @bindable() value: string | string[] = [];
  @bindable() mode: 'any' | 'all' = 'any';

  private subscriptions: IDisposable[] = [];

  private readonly element = resolve(INode) as HTMLElement;
  private readonly authService = resolve(IAuthService);
  private readonly ea = resolve(IEventAggregator);
  private display: string = '';

  attached() {
    this.display = this.element.style.display;
    this.update();

    const events = [
      AuthEvents.login,
      AuthEvents.logout,
      AuthEvents.authenticate,
      AuthEvents.refresh,
      AuthEvents.tabSync,
    ];

    for (const event of events) {
      this.subscriptions.push(this.ea.subscribe(event, () => this.update()));
    }
  }

  detaching() {
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
    this.subscriptions = [];
  }

  valueChanged() {
    this.update();
  }

  modeChanged() {
    this.update();
  }

  private update() {
    const roles = this.normalizeRoles(this.value);
    if (roles.length === 0) {
      this.element.style.display = this.display;
      return;
    }

    const hasAccess = this.mode === 'all'
      ? this.authService.hasAllRoles(roles)
      : this.authService.hasAnyRole(roles);

    this.element.style.display = hasAccess ? this.display : 'none';
  }

  private normalizeRoles(input: string | string[]): string[] {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string' && input.length > 0) {
      return input.split(',').map(r => r.trim()).filter(Boolean);
    }
    return [];
  }
}
