import { bindable } from "aurelia";
import { bootstrapOptions } from "../utils/bootstrap-options";
import type { AubsAccordionGroupCustomElement } from "./aubs-accordion-group";

export class AubsAccordionCustomElement {
  @bindable closeOthers = bootstrapOptions.accordionCloseOthers;
  groups: AubsAccordionGroupCustomElement[] = [];

  constructor() {}

  groupToggled(group: AubsAccordionGroupCustomElement) {
    if (group.isOpen && this.closeOthers) {
      for (let next of this.groups) {
        if (next !== group) {
          next.isOpen = false;
        }
      }
    }
  }

  registerGroup(group: AubsAccordionGroupCustomElement) {
    if (!this.groups.includes(group)) {
      this.groups.push(group);
    }
  }

  unregisterGroup(group: AubsAccordionGroupCustomElement) {
    const index = this.groups.indexOf(group);
    if (index >= 0) {
      this.groups.splice(index, 1);
    }
  }
}
