import { bindable, customElement, inject } from 'aurelia';
import template from './au-breadcrumbs.html';
import type { BreadcrumbItem } from './types';
import { RouterExtras } from './router-extras';

@customElement({
  name: 'au-breadcrumbs',
  template,
})
@inject(RouterExtras)
export class AuBreadcrumbsCustomElement {
  @bindable public items: BreadcrumbItem[] | null = null;

  public constructor(private readonly extras: RouterExtras) {}

  public binding(): void {
    if (this.items == null) {
      this.items = this.extras.breadcrumbs;
    }
  }
}
