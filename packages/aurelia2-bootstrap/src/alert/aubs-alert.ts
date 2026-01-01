import { INode, bindable, BindingMode, inject } from "aurelia";
import { Alert } from "bootstrap";

@inject(INode)
export class AubsAlertCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) isOpen = true;
  @bindable onClose;
  @bindable onClosed;

  instance;
  isAttached = false;
  suppressToggle = false;
  listeners;

  constructor(private element: HTMLElement) {
    this.listeners = {
      close: (event) => this.handleClose(event),
      closed: (event) => this.handleClosed(event),
    };
  }

  attached() {
    this.createInstance();
    this.addListeners();
    this.isAttached = true;

    if (!this.isOpen) {
      this.instance?.close();
    }
  }

  detached() {
    this.removeListeners();
    this.disposeInstance();
  }

  isOpenChanged() {
    if (!this.isAttached || this.suppressToggle) {
      this.suppressToggle = false;
      return;
    }

    if (!this.isOpen) {
      this.instance?.close();
    }
  }

  addListeners() {
    this.element.addEventListener("close.bs.alert", this.listeners.close);
    this.element.addEventListener("closed.bs.alert", this.listeners.closed);
  }

  removeListeners() {
    this.element.removeEventListener("close.bs.alert", this.listeners.close);
    this.element.removeEventListener("closed.bs.alert", this.listeners.closed);
  }

  createInstance() {
    this.instance = new Alert(this.element);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }

  handleClose(event) {
    if (typeof this.onClose === "function") {
      this.onClose({ event });
    }
  }

  handleClosed(event) {
    this.suppressToggle = true;
    this.isOpen = false;

    if (typeof this.onClosed === "function") {
      this.onClosed({ event });
    }
  }
}
