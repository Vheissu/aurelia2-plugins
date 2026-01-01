import { IAuthConfigOptions } from './configuration';

export function createDefaultAuthConfigOptions(
  window?: Window
): IAuthConfigOptions {
  const origin =
    window?.location?.origin ||
    (window?.location
      ? `${window.location.protocol}//${window.location.host}`
      : '');
  const originWithSlash = origin ? `${origin}/` : '';

  return {
    httpInterceptor: true,
    loginOnSignup: true,
    baseUrl: '/',
    loginRedirect: '#/',
    logoutRedirect: '#/',
    signupRedirect: '#/login',
    loginUrl: '/auth/login',
    signupUrl: '/auth/signup',
    profileUrl: '/auth/me',
    refreshUrl: '/auth/refresh',
    loginRoute: '/login',
    signupRoute: '/signup',
    tokenRoot: undefined,
    tokenName: 'token',
    idTokenName: 'id_token',
    refreshTokenRoot: undefined,
    refreshTokenName: 'refresh_token',
    tokenPrefix: 'aurelia',
    responseTokenProp: 'access_token',
    responseIdTokenProp: 'id_token',
    responseRefreshTokenProp: 'refresh_token',
    unlinkUrl: '/auth/unlink/',
    unlinkMethod: 'get',
    authHeader: 'Authorization',
    authToken: 'Bearer',
    withCredentials: true,
    platform: 'browser',
    storage: 'localStorage',
    refreshTokens: false,
    tokenExpirationLeeway: 0,
    pkce: false,
    pkceMethod: 'S256',
    providers: {
      identSrv: {
        name: 'identSrv',
        url: '/auth/identSrv',
        //authorizationEndpoint: 'http://localhost:22530/connect/authorize',
        redirectUri: origin,
        scope: ['profile', 'openid'],
        responseType: 'code',
        scopePrefix: '',
        scopeDelimiter: ' ',
        requiredUrlParams: ['scope', 'nonce'],
        optionalUrlParams: ['display', 'state'],
        state: function () {
          const rand = Math.random().toString(36).slice(2);
          return encodeURIComponent(rand);
        },
        display: 'popup',
        type: '2.0',
        clientId: 'jsClient',
        nonce: function () {
          const val = ((Date.now() + Math.random()) * Math.random())
            .toString()
            .replace('.', '');
          return encodeURIComponent(val);
        },
        popupOptions: { width: 452, height: 633 },
      },
      google: {
        name: 'google',
        url: '/auth/google',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        redirectUri: origin,
        scope: ['profile', 'email'],
        scopePrefix: 'openid',
        scopeDelimiter: ' ',
        requiredUrlParams: ['scope'],
        optionalUrlParams: ['display', 'state'],
        display: 'popup',
        type: '2.0',
        state: function () {
          const rand = Math.random().toString(36).slice(2);
          return encodeURIComponent(rand);
        },
        popupOptions: {
          width: 452,
          height: 633,
        },
      },
      apple: {
        name: 'apple',
        url: '/auth/apple',
        authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
        redirectUri: origin,
        scope: ['name', 'email'],
        scopePrefix: 'openid',
        scopeDelimiter: ' ',
        requiredUrlParams: ['scope'],
        optionalUrlParams: ['state'],
        responseType: 'code',
        display: 'popup',
        type: '2.0',
        state: function () {
          const rand = Math.random().toString(36).slice(2);
          return encodeURIComponent(rand);
        },
        popupOptions: {
          width: 452,
          height: 633,
        },
      },
      facebook: {
        name: 'facebook',
        url: '/auth/facebook',
        authorizationEndpoint: 'https://www.facebook.com/v2.9/dialog/oauth',
        redirectUri: originWithSlash,
        scope: ['email'],
        scopeDelimiter: ',',
        nonce: function () {
          return Math.random().toString(36).slice(2);
        },
        requiredUrlParams: ['nonce', 'display', 'scope'],
        display: 'popup',
        type: '2.0',
        popupOptions: {
          width: 580,
          height: 400,
        },
      },
      linkedin: {
        name: 'linkedin',
        url: '/auth/linkedin',
        authorizationEndpoint:
          'https://www.linkedin.com/oauth/v2/authorization',
        redirectUri: origin,
        requiredUrlParams: ['state'],
        scope: ['r_emailaddress'],
        scopeDelimiter: ' ',
        state: 'STATE',
        type: '2.0',
        popupOptions: {
          width: 527,
          height: 582,
        },
      },
      github: {
        name: 'github',
        url: '/auth/github',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        redirectUri: origin,
        optionalUrlParams: ['scope'],
        scope: ['user:email'],
        scopeDelimiter: ' ',
        type: '2.0',
        popupOptions: {
          width: 1020,
          height: 618,
        },
      },
      microsoft: {
        name: 'microsoft',
        url: '/auth/microsoft',
        authorizationEndpoint:
          'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        redirectUri: origin,
        scope: ['openid', 'profile', 'email'],
        scopeDelimiter: ' ',
        requiredUrlParams: ['scope'],
        optionalUrlParams: ['state'],
        responseType: 'code',
        type: '2.0',
        state: function () {
          const rand = Math.random().toString(36).slice(2);
          return encodeURIComponent(rand);
        },
        popupOptions: {
          width: 500,
          height: 560,
        },
      },
      x: {
        name: 'x',
        url: '/auth/x',
        authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
        redirectUri: origin,
        scope: ['tweet.read', 'users.read'],
        scopeDelimiter: ' ',
        requiredUrlParams: ['scope'],
        optionalUrlParams: ['state'],
        responseType: 'code',
        pkce: true,
        pkceMethod: 'S256',
        state: function () {
          const rand = Math.random().toString(36).slice(2);
          return encodeURIComponent(rand);
        },
        popupOptions: {
          width: 550,
          height: 600,
        },
        type: '2.0',
      },
      yahoo: {
        name: 'yahoo',
        url: '/auth/yahoo',
        authorizationEndpoint: 'https://api.login.yahoo.com/oauth2/request_auth',
        redirectUri: origin,
        scope: [],
        scopeDelimiter: ',',
        type: '2.0',
        popupOptions: {
          width: 559,
          height: 519,
        },
      },
      live: {
        name: 'live',
        url: '/auth/live',
        authorizationEndpoint: 'https://login.live.com/oauth20_authorize.srf',
        redirectUri: origin,
        scope: ['wl.emails'],
        scopeDelimiter: ' ',
        requiredUrlParams: ['display', 'scope'],
        display: 'popup',
        type: '2.0',
        popupOptions: {
          width: 500,
          height: 560,
        },
      },
      instagram: {
        name: 'instagram',
        url: '/auth/instagram',
        authorizationEndpoint: 'https://api.instagram.com/oauth/authorize',
        redirectUri: origin,
        requiredUrlParams: ['scope'],
        scope: ['user_profile', 'user_media'],
        scopeDelimiter: ',',
        display: 'popup',
        type: '2.0',
        popupOptions: {
          width: 550,
          height: 369,
        },
      },
    },
  };
}
