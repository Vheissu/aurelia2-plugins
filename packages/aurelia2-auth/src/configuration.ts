import { DI } from '@aurelia/kernel';

export interface IAuthConfigOptions {
  httpInterceptor?: boolean;
  loginOnSignup?: boolean;
  baseUrl?: string;
  loginRedirect?: string;
  logoutRedirect?: string;
  signupRedirect?: string;
  loginUrl?: string;
  signupUrl?: string;
  profileUrl?: string;
  loginRoute?: string;
  signupRoute?: string;
  tokenRoot?: string;
  tokenName?: string;
  idTokenName?: string;
  tokenPrefix?: string;
  responseTokenProp?: string;
  responseIdTokenProp?: string;
  unlinkUrl?: string;
  unlinkMethod?: string;
  authHeader?: string;
  authToken?: string;
  withCredentials?: boolean;
  platform?: string;
  storage?: string;
  providers?: unknown;
}

export const IAuthOptions =
  DI.createInterface<IAuthConfigOptions>('IAuthOptions');
