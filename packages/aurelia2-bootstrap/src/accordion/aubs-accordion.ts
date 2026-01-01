import { bindable } from "aurelia";
import { bootstrapOptions } from "../utils/bootstrap-options";

export class AubsAccordionCustomElement {
  @bindable closeOthers = bootstrapOptions.accordionCloseOthers;
  groups = [];

  constructor() {}

  groupToggled(group) {
    if (group.isOpen && this.closeOthers) {
      for (let next of this.groups) {
        if (next !== group) {
          next.isOpen = false;
        }
      }
    }
  }

  registerGroup(group) {
    if (!this.groups.includes(group)) {
      this.groups.push(group);
    }
  }

  unregisterGroup(group) {
    const index = this.groups.indexOf(group);
    if (index >= 0) {
      this.groups.splice(index, 1);
    }
  }
}
