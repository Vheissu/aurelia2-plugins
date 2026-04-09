import { CustomAttribute, INode, inject } from "aurelia";
import { AubsDropdownCustomAttribute } from "./aubs-dropdown";

@inject(INode)
export class AubsDropdownToggleCustomAttribute {
  private clickedListener: (() => void) | null;
  private dropdown: AubsDropdownCustomAttribute | null = null;

  constructor(
    private element: HTMLElement
  ) {
    this.clickedListener = () => this.dropdown?.toggle();
  }

  attached() {
    const controller = CustomAttribute.closest(this.element, AubsDropdownCustomAttribute);
    this.dropdown = (controller as { viewModel?: AubsDropdownCustomAttribute } | null)?.viewModel ?? null;

    if (this.dropdown) {
      this.element.addEventListener("click", this.clickedListener!);
    }
  }

  detached() {
    if (this.dropdown && this.clickedListener) {
      this.element.removeEventListener("click", this.clickedListener);
    }
    this.dropdown = null;
    this.clickedListener = null;
  }
}
