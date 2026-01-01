import {
  inject,
  bindable,
  BindingMode,
  containerless,
} from "aurelia";
import { bootstrapOptions } from "../utils/bootstrap-options";
import velocity from "velocity-animate";
import { AubsAccordionCustomElement } from "./aubs-accordion";

@containerless
@inject(AubsAccordionCustomElement)
export class AubsAccordionGroupCustomElement {
  @bindable title;
  @bindable panelClass = bootstrapOptions.accordionGroupPanelClass;
  @bindable({ mode: BindingMode.twoWay }) isOpen = false;
  @bindable disabled = false;

  showClass;
  accordion;
  $collapse;
  headerButton;

  constructor(accordion) {
    this.accordion = accordion;
  }

  bind() {
    if (typeof this.isOpen !== "boolean") {
      this.isOpen = false;
    }

    this.showClass = "show";
  }

  attached() {
    this.accordion.registerGroup(this);
    if (this.isOpen) {
      this.$collapse.classList.add(this.showClass);
      this.headerButton?.classList.remove("collapsed");
      velocity(this.$collapse, "slideDown", { duration: 0 });
    }
  }

  detached() {
    this.accordion.unregisterGroup(this);
  }

  isOpenChanged() {
    this.animate();

    if (this.isOpen) {
      this.accordion.groupToggled(this);
    }
  }

  toggle() {
    if (this.disabled) {
      return;
    }
    this.isOpen = !this.isOpen;
  }

  animate() {
    if (this.isOpen) {
      this.$collapse.classList.add(this.showClass);
      this.headerButton?.classList.remove("collapsed");
      velocity(this.$collapse, "slideDown");
    } else {
      velocity(this.$collapse, "slideUp");
      this.$collapse.classList.remove(this.showClass);
      this.headerButton?.classList.add("collapsed");
    }
  }
}
