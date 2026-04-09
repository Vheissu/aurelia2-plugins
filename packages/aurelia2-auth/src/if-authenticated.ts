import { customAttribute, INode, bindable, resolve } from 'aurelia';
import { IAuthService } from './auth-service';
import { IEventAggregator, IDisposable } from '@aurelia/kernel';
import { AuthEvents } from './auth-events';

@customAttribute('if-authenticated')
export class IfAuthenticatedCustomAttribute {
  @bindable() value: boolean = true;

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

  private update() {
    const isAuth = this.authService.isAuthenticated();
    const shouldShow = this.value ? isAuth : !isAuth;
    this.element.style.display = shouldShow ? this.display : 'none';
  }
}
