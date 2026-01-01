import { INode, bindable, BindingMode, inject } from "aurelia";
import { Button } from "bootstrap";

@inject(INode)
export class AubsButtonToggleCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) active = false;
  @bindable onToggle;

  instance;
  isAttached = false;
  suppressActive = false;
  clickListener;

  constructor(private element: HTMLElement) {
    this.clickListener = () => this.handleClick();
  }

  attached() {
    this.createInstance();
    this.isAttached = true;
    this.element.addEventListener("click", this.clickListener);

    this.syncState();
  }

  detached() {
    this.element.removeEventListener("click", this.clickListener);
    this.disposeInstance();
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
