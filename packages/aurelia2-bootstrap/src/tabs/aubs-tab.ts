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
    this.$tabPane.style.display = this.active ? "block" : "none";
  }

  handleTabChanged(index) {
    let isSelected = index === this.index;

    if (isSelected === this.active) {
      return;
    }

    this.active = isSelected;

    if (isSelected) {
      if (this.$tabPane) {
        velocity(this.$tabPane, "fadeIn");
      }

      if (typeof this.onSelect === "function") {
        this.onSelect({ index: this.index });
      }
    } else {
      this.$tabPane.style.display = "none";

      if (typeof this.onDeselect === "function") {
        this.onDeselect({ index: this.index });
      }
    }
  }
}
