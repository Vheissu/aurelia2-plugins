import { bindable, INode, inject } from "aurelia";
import { bootstrapOptions } from "../utils/bootstrap-options";

@inject(INode)
export class AubsBtnLoadingCustomAttribute {
  @bindable loading;
  @bindable text = bootstrapOptions.btnLoadingText;
  @bindable disabled = false;

  isAttached = false;
  innerHTML;

  constructor(private element: HTMLButtonElement) {
    if (this.element.tagName !== "BUTTON" && this.element.tagName !== "A") {
      throw new Error(
        "The aubs-btn-loading attribute can only be used in button and anchor elements"
      );
    }
  }

  attached() {
    this.isAttached = true;
    this.innerHTML = this.element.innerHTML;
    this.setClass();
    this.disabledChanged();
  }

  loadingChanged() {
    if (this.isAttached) {
      this.setClass();
    }
  }

  disabledChanged() {
    if (!this.isAttached) {
      return;
    }

    if (this.disabled) {
      if (!this.loading) {
        this.element.classList.add("disabled");
        this.element.disabled = true;
      }
    } else {
      if (!this.loading) {
        this.element.classList.remove("disabled");
        this.element.disabled = false;
      }
    }
  }

  setClass() {
    if (this.loading) {
      this.innerHTML = this.element.innerHTML;
      this.element.innerHTML = this.text;
      this.element.classList.add("disabled");
      this.element.disabled = true;
    } else {
      this.element.innerHTML = this.innerHTML;

      if (!this.disabled) {
        this.element.classList.remove("disabled");
        this.element.disabled = false;
      }
    }
  }
}
