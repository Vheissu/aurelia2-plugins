import { INode, bindable, BindingMode, inject } from "aurelia";
import { Offcanvas } from "bootstrap";

type OffcanvasOptions = ConstructorParameters<typeof Offcanvas>[1];

interface OffcanvasEventCallbackPayload {
  event: Event;
}

@inject(INode)
export class AubsOffcanvasCustomAttribute {
  @bindable options: OffcanvasOptions;
  @bindable({ mode: BindingMode.twoWay }) isOpen = false;
  @bindable onShow: ((payload: OffcanvasEventCallbackPayload) => void) | undefined;
  @bindable onShown: ((payload: OffcanvasEventCallbackPayload) => void) | undefined;
  @bindable onHide: ((payload: OffcanvasEventCallbackPayload) => void) | undefined;
  @bindable onHidden: ((payload: OffcanvasEventCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Offcanvas> | null = null;
  private isAttached = false;
  private suppressToggle = false;
  private listeners: {
    show: (event: Event) => void;
    shown: (event: Event) => void;
    hide: (event: Event) => void;
    hidden: (event: Event) => void;
  } | null;

  constructor(private element: HTMLElement) {
    this.listeners = {
      show: (event: Event) => this.handleShow(event),
      shown: (event: Event) => this.handleShown(event),
      hide: (event: Event) => this.handleHide(event),
      hidden: (event: Event) => this.handleHidden(event),
    };
  }

  attached() {
    this.createInstance();
    this.addListeners();
    this.isAttached = true;

    if (this.isOpen) {
      this.instance?.show();
    }
  }

  detached() {
    this.removeListeners();
    this.disposeInstance();
    this.listeners = null;
    this.isAttached = false;
  }

  optionsChanged() {
    if (!this.isAttached) {
      return;
    }

    const shouldBeOpen = this.isOpen;
    this.removeListeners();
    this.disposeInstance();
    this.createInstance();
    this.addListeners();

    if (shouldBeOpen) {
      this.instance?.show();
    }
  }

  isOpenChanged() {
    if (!this.isAttached || this.suppressToggle) {
      this.suppressToggle = false;
      return;
    }

    if (this.isOpen) {
      this.instance?.show();
    } else {
      this.instance?.hide();
    }
  }

  addListeners() {
    if (!this.listeners) return;
    this.element.addEventListener("show.bs.offcanvas", this.listeners.show);
    this.element.addEventListener("shown.bs.offcanvas", this.listeners.shown);
    this.element.addEventListener("hide.bs.offcanvas", this.listeners.hide);
    this.element.addEventListener("hidden.bs.offcanvas", this.listeners.hidden);
  }

  removeListeners() {
    if (!this.listeners) return;
    this.element.removeEventListener("show.bs.offcanvas", this.listeners.show);
    this.element.removeEventListener("shown.bs.offcanvas", this.listeners.shown);
    this.element.removeEventListener("hide.bs.offcanvas", this.listeners.hide);
    this.element.removeEventListener("hidden.bs.offcanvas", this.listeners.hidden);
  }

  createInstance() {
    this.instance = new Offcanvas(this.element, this.options ?? undefined);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }

  private handleShow(event: Event) {
    if (typeof this.onShow === "function") {
      this.onShow({ event });
    }
  }

  private handleShown(event: Event) {
    this.suppressToggle = true;
    this.isOpen = true;

    if (typeof this.onShown === "function") {
      this.onShown({ event });
    }
  }

  private handleHide(event: Event) {
    if (typeof this.onHide === "function") {
      this.onHide({ event });
    }
  }

  private handleHidden(event: Event) {
    this.suppressToggle = true;
    this.isOpen = false;

    if (typeof this.onHidden === "function") {
      this.onHidden({ event });
    }
  }
}
