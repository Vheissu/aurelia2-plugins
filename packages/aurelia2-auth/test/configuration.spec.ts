import { DI, Registration } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import { AureliaAuthConfiguration } from '../src';
import { IAuthOptions } from '../src/configuration';

describe('AureliaAuthConfiguration', () => {
  test('keeps secure defaults and composes chained provider and policy overrides', () => {
    const container = DI.createContainer();
    container.register(Registration.instance(IWindow, window));
    const paid = (): boolean => true;
    const internal = (): boolean => true;

    AureliaAuthConfiguration
      .configure({
        providers: { google: { clientId: 'google-client' } },
        policies: { paid },
      })
      .configure({
        providers: { github: { clientId: 'github-client' } },
        policies: { internal },
      })
      .register(container);

    const options = container.get(IAuthOptions);
    expect(options).toMatchObject({
      mode: 'bearer',
      storage: 'sessionStorage',
      loginRedirect: null,
      logoutRedirect: null,
      pkce: true,
      pkceMethod: 'S256',
      popupTimeout: 300_000,
    });
    expect(options.providers?.google).toMatchObject({
      name: 'google',
      clientId: 'google-client',
      flow: 'authorization-code',
      exchange: 'backend',
    });
    expect(options.providers?.github).toMatchObject({
      name: 'github',
      clientId: 'github-client',
    });
    expect(options.policies).toMatchObject({ paid, internal });
  });
});
