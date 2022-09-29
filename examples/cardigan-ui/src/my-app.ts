import { Buttons } from './buttons';
import { Headings } from './headings';

import { IRoute } from '@aurelia/router';

export class MyApp {
  static routes: IRoute[] = [
    {
      component: Buttons,
      path: 'buttons',
      title: 'Buttons',
    },
    {
      component: Headings,
      path: 'headings',
      title: 'Headings'
    },
  ];
}
