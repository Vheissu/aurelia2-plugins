import { INode, bindable, inject } from "aurelia";
import { ScrollSpy } from "bootstrap";

@inject(INode)
export class AubsScrollspyCustomAttribute {
  @bindable options;
  @bindable enabled = true;
  @bindable refreshTrigger = 0;
  @bindable onActivate;

  instance;
  isAttached = false;
  listeners;

  constructor(private element: HTMLElement) {
    this.listeners = {
      activate: (event) => this.handleActivate(event),
    };
  }

  attached() {
    if (this.enabled) {
      this.createInstance();
      this.addListeners();
    }
    this.isAttached = true;
  }

  detached() {
    this.removeListeners();
    this.disposeInstance();
  }

  enabledChanged() {
    if (!this.isAttached) {
      return;
    }

    if (this.enabled) {
      this.createInstance();
      this.addListeners();
    } else {
      this.removeListeners();
      this.disposeInstance();
    }
  }

  optionsChanged() {
    if (!this.isAttached || !this.enabled) {
      return;
    }

    this.removeListeners();
    this.disposeInstance();
    this.createInstance();
    this.addListeners();
  }

  refreshTriggerChanged() {
    this.instance?.refresh?.();
  }

  addListeners() {
    this.element.addEventListener("activate.bs.scrollspy", this.listeners.activate);
  }

  removeListeners() {
    this.element.removeEventListener("activate.bs.scrollspy", this.listeners.activate);
  }

  createInstance() {
    this.instance = new ScrollSpy(this.element, this.options ?? undefined);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }

  handleActivate(event) {
    if (typeof this.onActivate === "function") {
      this.onActivate({ event });
    }
  }
}
