import { customElement } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { tasksSettled } from '@aurelia/runtime';
import { ILifecycleHooks } from '@aurelia/runtime-html';
import { IEventAggregator, Registration } from '@aurelia/kernel';
import { HttpClient, IHttpClient } from '@aurelia/fetch-client';
import { IRouter, route, RouterConfiguration } from '@aurelia/router';
import {
  AureliaAuthConfiguration,
  IAuthService,
  AuthEvents,
  anonymousOnly,
  authenticated,
  roles,
} from '../src';
import { createJwt } from './helpers';

@customElement({ name: 'home-page', template: '<h1>Home</h1>' })
class HomePage {}

@anonymousOnly()
@customElement({ name: 'login-page', template: '<h1>Login</h1>' })
class LoginPage {}

@authenticated()
@customElement({ name: 'account-page', template: '<h1>Account</h1>' })
class AccountPage {}

@roles('admin')
@customElement({ name: 'admin-page', template: '<h1>Admin</h1>' })
class AdminPage {}

@customElement({ name: 'forbidden-page', template: '<h1>Forbidden</h1>' })
class ForbiddenPage {}

@route({
  routes: [
    { path: '', component: HomePage },
    { path: 'login', component: LoginPage },
    { path: 'account', component: AccountPage, data: { auth: true } },
    { path: 'admin', component: AdminPage },
    { path: 'forbidden', component: ForbiddenPage },
  ],
})
class RouterApp {
  public adminRule = { roles: ['admin'] };
}

describe('Aurelia integration', () => {
  test('integrates guards, decorators and attributes with a real Aurelia application', async () => {
    const fixture = createFixture(
      `<au-viewport></au-viewport>
       <button id="member" if-authenticated>Member</button>
       <button id="guest" if-authenticated.bind="false">Guest</button>
       <button id="admin-action" auth="value.bind: adminRule; mode: disable">Admin action</button>`,
      RouterApp,
      [
        Registration.singleton(HttpClient, HttpClient),
        Registration.aliasTo(HttpClient, IHttpClient),
        RouterConfiguration.customize({ historyStrategy: 'none' }),
        AureliaAuthConfiguration.configure({
          storage: 'memory',
          transactionStorage: 'memory',
          loginRoute: '/login',
          unauthorizedRoute: '/forbidden',
          authenticatedRoute: '/',
          tabSync: false,
        }),
      ],
    );
    await fixture.startPromise;
    try {
      const router = fixture.container.get(IRouter);
      const auth = fixture.container.get(IAuthService);
      const member = fixture.appHost.querySelector('#member') as HTMLButtonElement;
      const guest = fixture.appHost.querySelector('#guest') as HTMLButtonElement;
      const adminAction = fixture.appHost.querySelector('#admin-action') as HTMLButtonElement;
      await flush();

      expect(fixture.container.getAll(ILifecycleHooks).map(hook => hook.constructor.name))
        .toContain('AuthorizeHook');
      expect(member.hidden).toBe(true);
      expect(guest.hidden).toBe(false);
      expect(adminAction.disabled).toBe(true);

      await router.load('/account');
      expect(fixture.appHost.textContent).toContain('Login');

      const stateChanged = jest.fn();
      fixture.container.get(IEventAggregator).subscribe(AuthEvents.stateChanged, stateChanged);
      auth.setToken(createJwt({
        exp: Math.floor(Date.now() / 1000) + 60,
        roles: ['member'],
      }));
      await tasksSettled();
      await flush();
      expect(stateChanged).toHaveBeenCalledTimes(1);
      expect(member.hidden).toBe(false);
      expect(guest.hidden).toBe(true);
      expect(adminAction.disabled).toBe(true);

      await router.load('/account');
      expect(fixture.appHost.textContent).toContain('Account');
      await router.load('/admin');
      expect(fixture.appHost.textContent).toContain('Forbidden');

      auth.setToken(createJwt({
        exp: Math.floor(Date.now() / 1000) + 60,
        roles: ['admin'],
      }));
      await tasksSettled();
      await flush();
      expect(adminAction.disabled).toBe(false);
      expect(adminAction.hasAttribute('aria-disabled')).toBe(false);
      await router.load('/admin');
      expect(fixture.appHost.textContent).toContain('Admin');

      await router.load('/login');
      expect(fixture.appHost.textContent).toContain('Home');
    } finally {
      await fixture.tearDown();
    }
  });
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
