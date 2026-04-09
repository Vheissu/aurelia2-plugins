import { INode, bindable, inject } from "aurelia";
import { ScrollSpy } from "bootstrap";

type ScrollSpyOptions = ConstructorParameters<typeof ScrollSpy>[1];

interface ScrollSpyEventCallbackPayload {
  event: Event;
}

@inject(INode)
export class AubsScrollspyCustomAttribute {
  @bindable options: ScrollSpyOptions;
  @bindable enabled = true;
  @bindable refreshTrigger = 0;
  @bindable onActivate: ((payload: ScrollSpyEventCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof ScrollSpy> | null = null;
  private isAttached = false;
  private listeners: {
    activate: (event: Event) => void;
  } | null;

  constructor(private element: HTMLElement) {
    this.listeners = {
      activate: (event: Event) => this.handleActivate(event),
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
    this.listeners = null;
    this.isAttached = false;
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
    if (!this.listeners) return;
    this.element.addEventListener("activate.bs.scrollspy", this.listeners.activate);
  }

  removeListeners() {
    if (!this.listeners) return;
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

  private handleActivate(event: Event) {
    if (typeof this.onActivate === "function") {
      this.onActivate({ event });
    }
  }
}
