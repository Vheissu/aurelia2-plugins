import { CustomAttribute, INode, inject } from "aurelia";
import { AubsDropdownCustomAttribute } from "./aubs-dropdown";

@inject(INode)
export class AubsDropdownToggleCustomAttribute {
  clickedListener;
  dropdown;

  constructor(
    private element: HTMLElement
  ) {
    this.clickedListener = () => this.dropdown?.toggle();
  }

  attached() {
    const controller = CustomAttribute.closest(this.element, AubsDropdownCustomAttribute);
    this.dropdown = controller?.viewModel ?? null;

    if (this.dropdown) {
      this.element.addEventListener("click", this.clickedListener);
    }
  }

  detached() {
    if (this.dropdown) {
      this.element.removeEventListener("click", this.clickedListener);
    }
  }
}
