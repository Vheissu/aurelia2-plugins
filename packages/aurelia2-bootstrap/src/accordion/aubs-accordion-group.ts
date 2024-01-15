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

  constructor(accordion) {
    this.accordion = accordion;
    this.accordion.register(this);
  }

  bind() {
    if (typeof this.isOpen !== "boolean") {
      this.isOpen = false;
    }

    this.showClass = this.isBootstrapVersion(4) ? "show" : "in";
  }

  attached() {
    if (this.isOpen) {
      this.$collapse.classList.add("in");
      velocity(this.$collapse, "slideDown", { duration: 0 });
    }
  }

  isBootstrapVersion(version) {
    return bootstrapOptions.version === version;
  }

  isOpenChanged() {
    this.animate();

    if (this.isOpen) {
      this.accordion.groupToggled(this);
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  animate() {
    if (this.isOpen) {
      this.$collapse.classList.add(this.showClass);
      velocity(this.$collapse, "slideDown");
    } else {
      velocity(this.$collapse, "slideUp");
      this.$collapse.classList.remove(this.showClass);
    }
  }
}
