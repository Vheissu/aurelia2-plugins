import { INode, bindable } from "aurelia";
import velocity from "velocity-animate";
import { bootstrapOptions } from "../utils/bootstrap-options";

export class AubsCollapseCustomAttribute {
  @bindable collapsed = false;
  showClass;
  isAttached = false;

  constructor(@INode private element: HTMLElement) {
  }

  bound() {
    this.showClass = bootstrapOptions.version === 4 ? "show" : "in";
  }

  attached() {
    if (this.collapsed) {
      this.element.style.display = "none";
    }

    this.isAttached = true;
  }

  collapsedChanged() {
    if (!this.isAttached) {
      return;
    }

    if (this.collapsed) {
      velocity(this.element, "slideUp");
      this.element.classList.remove(this.showClass);
    } else {
      this.element.classList.add(this.showClass);
      velocity(this.element, "slideDown");
    }
  }
}
