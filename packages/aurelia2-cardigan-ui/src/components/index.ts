import { IRegistry } from "aurelia";

import { CardiganSelectCustomElement } from "./cardigan-select";
import { CardiganModalCustomElement } from "./cardigan-modal";
import { CardiganImageCustomElement } from "./cardigan-image";
import { CardiganButtonCustomElement } from "./cardigan-button";
import { CardiganHeadingCustomElement } from "./cardigan-heading";
import { CardiganCodeCustomElement } from "./cardigan-code";

export const DefaultComponents: IRegistry[] = [
  CardiganButtonCustomElement as unknown as IRegistry,
  CardiganCodeCustomElement as unknown as IRegistry,
  CardiganHeadingCustomElement as unknown as IRegistry,
  CardiganImageCustomElement as unknown as IRegistry,
  CardiganModalCustomElement as unknown as IRegistry,
  CardiganSelectCustomElement as unknown as IRegistry,
];
