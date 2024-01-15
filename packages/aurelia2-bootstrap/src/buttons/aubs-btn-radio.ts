import { inject, bindable, BindingMode, INode } from "aurelia";

@inject(Element)
export class AubsBtnRadioCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) model;
  @bindable value;

  clickedListener;

  constructor(@INode private element: HTMLButtonElement) {
    if (this.element.tagName !== "BUTTON" && this.element.tagName !== "A") {
      throw new Error(
        "The aubs-btn-radio attribute can only be used in button and anchor elements"
      );
    }

    this.clickedListener = () => this.buttonClicked();
  }

  bound() {
    if (this.value == null || this.value == undefined) {
      throw new Error("Must provide a value for the radio button");
    }
  }

  attached() {
    this.element.addEventListener("click", this.clickedListener);
    this.setClass();
  }

  detached() {
    this.element.removeEventListener("click", this.clickedListener);
  }

  modelChanged() {
    this.setClass();
  }

  buttonClicked() {
    if (this.model == this.value) {
      return;
    }

    this.model = this.value;
  }

  setClass() {
    if (this.model == this.value) {
      this.element.classList.add("active");
    } else {
      this.element.classList.remove("active");
    }
  }
}
