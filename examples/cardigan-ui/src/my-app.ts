import { Home } from './home';
import { Buttons } from './buttons';
import { Headings } from './headings';
import { CardiganCode } from './cardigan-code';

import { IRoute } from '@aurelia/router';

export class MyApp {
  static routes: IRoute[] = [
    {
      component: Home,
      path: '',
      title: 'Cardigan UI'
    },
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
    {
      component: CardiganCode,
      path: 'code',
      title: 'Code'
    },
  ];
}
