import { Registration } from '@aurelia/kernel';
import { OAuth2 } from '../src/oAuth2';
import { IOAuthClient } from '../src/oauth-client';
import { createUnitContainer } from './helpers';

describe('OAuth2 compatibility facade', () => {
  test('forwards open, begin and complete to the standards-oriented client', async () => {
    const client = {
      start: jest.fn().mockResolvedValue({ access_token: 'from-open' }),
      begin: jest.fn().mockResolvedValue({ url: 'https://issuer.example/authorize' }),
      complete: jest.fn().mockResolvedValue({ access_token: 'from-callback' }),
    };
    const { container } = createUnitContainer({}, [
      Registration.instance(IOAuthClient, client),
    ]);
    const oauth2 = container.invoke(OAuth2);

    await expect(oauth2.open({ name: 'google' }, { invite: '123' }))
      .resolves.toEqual({ access_token: 'from-open' });
    await expect(oauth2.begin('google', { display: 'popup' }))
      .resolves.toEqual({ url: 'https://issuer.example/authorize' });
    await expect(oauth2.complete('?code=abc&state=state', 'google', { invite: '123' }))
      .resolves.toEqual({ access_token: 'from-callback' });

    expect(client.start).toHaveBeenCalledWith('google', { userData: { invite: '123' } });
    expect(client.begin).toHaveBeenCalledWith('google', { display: 'popup' });
    expect(client.complete).toHaveBeenCalledWith(
      '?code=abc&state=state',
      'google',
      { invite: '123' },
    );
  });

  test('rejects unnamed legacy provider objects before delegation', async () => {
    const client = { start: jest.fn(), begin: jest.fn(), complete: jest.fn() };
    const { container } = createUnitContainer({}, [
      Registration.instance(IOAuthClient, client),
    ]);
    const oauth2 = container.invoke(OAuth2);

    await expect(oauth2.open({ clientId: 'missing-name' }))
      .rejects.toMatchObject({ code: 'invalid-configuration' });
    expect(client.start).not.toHaveBeenCalled();
  });
});
