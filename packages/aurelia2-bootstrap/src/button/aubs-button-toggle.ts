import { INode, bindable, BindingMode, inject } from "aurelia";
import { Button } from "bootstrap";

interface ButtonToggleCallbackPayload {
  active: boolean;
}

@inject(INode)
export class AubsButtonToggleCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) active = false;
  @bindable onToggle: ((payload: ButtonToggleCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Button> | null = null;
  private isAttached = false;
  private suppressActive = false;
  private clickListener: (() => void) | null;

  constructor(private element: HTMLElement) {
    this.clickListener = () => this.handleClick();
  }

  attached() {
    this.createInstance();
    this.isAttached = true;
    if (this.clickListener) {
      this.element.addEventListener("click", this.clickListener);
    }

    this.syncState();
  }

  detached() {
    if (this.clickListener) {
      this.element.removeEventListener("click", this.clickListener);
    }
    this.disposeInstance();
    this.clickListener = null;
    this.isAttached = false;
  }

  activeChanged() {
    if (!this.isAttached || this.suppressActive) {
      this.suppressActive = false;
      return;
    }

    this.syncState();
  }

  handleClick() {
    this.instance?.toggle();

    this.suppressActive = true;
    this.active = this.isActive();

    if (typeof this.onToggle === "function") {
      this.onToggle({ active: this.active });
    }
  }

  syncState() {
    const current = this.isActive();
    if (current !== this.active) {
      this.instance?.toggle();
    }
  }

  isActive() {
    return this.element.classList.contains("active");
  }

  createInstance() {
    this.instance = new Button(this.element);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }
}
