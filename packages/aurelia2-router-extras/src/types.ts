import type { Params } from '@aurelia/router';

export interface BreadcrumbItem {
  title: string;
  path: string;
  params: Params | null;
  data: Record<string, unknown>;
  active?: boolean;
}

export interface MetaEntry {
  name?: string;
  property?: string;
  content: string;
}
