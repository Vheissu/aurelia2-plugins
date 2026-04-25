export type HeadAttributeValue = string | number | boolean | null | undefined;

export interface HeadMetaDefinition {
  name?: string;
  property?: string;
  httpEquiv?: string;
  charset?: string;
  content?: string | number | boolean;
  key?: string;
}

export type HeadMetaInput =
  | HeadMetaDefinition[]
  | Record<string, string | number | boolean | HeadMetaDefinition | null | undefined>
  | null
  | undefined;

export interface HeadLinkDefinition {
  rel: string;
  href: string;
  as?: string;
  type?: string;
  media?: string;
  sizes?: string;
  crossorigin?: string;
  hreflang?: string;
  key?: string;
}

export type HeadAttributes = Record<string, HeadAttributeValue>;

export interface HeadState {
  title?: string | null;
  titleTemplate?: string | null;
  meta?: HeadMetaInput;
  links?: HeadLinkDefinition[] | null;
  htmlAttrs?: HeadAttributes | null;
  bodyAttrs?: HeadAttributes | null;
}

export interface HeadManagerOptions {
  defaultTitle?: string;
  titleTemplate?: string;
  manageTitle?: boolean;
}

export interface HeadHandle {
  readonly owner: string;
  update(state: HeadState): void;
  dispose(): void;
}
