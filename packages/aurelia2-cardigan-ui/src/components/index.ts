import {IRegistry } from '@aurelia/kernel';

import { AuSelectCustomElement } from './au-select';
import { AuModalCustomElement } from './au-modal';
import { AuImageCustomElement } from './au-image';
import { AuButtonCustomElement } from './au-button';
import { AuHeadingCustomElement } from './au-heading';
import { AuCodeCustomElement } from './au-code';

export const DefaultComponents: IRegistry[] = [
    AuButtonCustomElement as unknown as IRegistry,
    AuImageCustomElement as unknown as IRegistry,
    AuModalCustomElement as unknown as IRegistry,
    AuSelectCustomElement as unknown as IRegistry,
    AuHeadingCustomElement as unknown as IRegistry,
    AuCodeCustomElement as unknown as IRegistry,
];