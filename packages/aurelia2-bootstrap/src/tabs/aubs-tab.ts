import { bindable, inject, INode } from "aurelia";
import { AubsTabsetCustomElement } from "./aubs-tabset";
import velocity from "velocity-animate";

@inject(AubsTabsetCustomElement, INode)
export class AubsTabCustomElement {
  @bindable header;
  @bindable disabled = false;
  @bindable onSelect;
  @bindable onDeselect;

  index;
  active = false;

  private tabset: AubsTabsetCustomElement;
  private element: Element;

  $tabPane;

  constructor(tabset: AubsTabsetCustomElement, element: HTMLElement) {
    this.tabset = tabset;
    this.element = element;
  }

  bound() {
    if (!this.header) {
      throw new Error("Must provide a header for the tab.");
    }
  }

  attached() {
    this.$tabPane = this.element.querySelector(".tab-pane");
    this.applyActiveState(false);
    this.tabset.registerTab(this);
  }

  detached() {
    this.tabset.unregisterTab(this);
  }

  handleTabChanged(index) {
    let isSelected = index === this.index;

    if (isSelected === this.active) {
      return;
    }

    this.active = isSelected;
    this.applyActiveState(true);

    if (isSelected) {
      if (typeof this.onSelect === "function") {
        this.onSelect({ index: this.index });
      }
    } else if (typeof this.onDeselect === "function") {
      this.onDeselect({ index: this.index });
    }
  }

  applyActiveState(animate: boolean) {
    if (!this.$tabPane) {
      return;
    }

    if (this.active) {
      this.$tabPane.classList.add("active", "show");
      this.$tabPane.style.display = "block";
      if (animate) {
        velocity(this.$tabPane, "fadeIn");
      }
      return;
    }

    this.$tabPane.classList.remove("active", "show");
    if (animate) {
      velocity(this.$tabPane, "fadeOut").then(() => {
        this.$tabPane.style.display = "none";
      });
    } else {
      this.$tabPane.style.display = "none";
    }
  }
}
