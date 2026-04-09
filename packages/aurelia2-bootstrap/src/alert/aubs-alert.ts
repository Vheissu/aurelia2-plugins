import { INode, bindable, BindingMode, inject } from "aurelia";
import { Alert } from "bootstrap";

interface AlertEventCallbackPayload {
  event: Event;
}

@inject(INode)
export class AubsAlertCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) isOpen = true;
  @bindable onClose: ((payload: AlertEventCallbackPayload) => void) | undefined;
  @bindable onClosed: ((payload: AlertEventCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Alert> | null = null;
  private isAttached = false;
  private suppressToggle = false;
  private listeners: {
    close: (event: Event) => void;
    closed: (event: Event) => void;
  } | null;

  constructor(private element: HTMLElement) {
    this.listeners = {
      close: (event: Event) => this.handleClose(event),
      closed: (event: Event) => this.handleClosed(event),
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
    this.listeners = null;
    this.isAttached = false;
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
    if (!this.listeners) return;
    this.element.addEventListener("close.bs.alert", this.listeners.close);
    this.element.addEventListener("closed.bs.alert", this.listeners.closed);
  }

  removeListeners() {
    if (!this.listeners) return;
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

  private handleClose(event: Event) {
    if (typeof this.onClose === "function") {
      this.onClose({ event });
    }
  }

  private handleClosed(event: Event) {
    this.suppressToggle = true;
    this.isOpen = false;

    if (typeof this.onClosed === "function") {
      this.onClosed({ event });
    }
  }
}
