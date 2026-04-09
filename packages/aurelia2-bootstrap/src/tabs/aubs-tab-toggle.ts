import { INode, bindable, BindingMode, inject } from "aurelia";
import { Tab } from "bootstrap";

interface TabEventCallbackPayload {
  event: Event;
}

@inject(INode)
export class AubsTabToggleCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) active = false;
  @bindable onShow: ((payload: TabEventCallbackPayload) => void) | undefined;
  @bindable onShown: ((payload: TabEventCallbackPayload) => void) | undefined;
  @bindable onHide: ((payload: TabEventCallbackPayload) => void) | undefined;
  @bindable onHidden: ((payload: TabEventCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Tab> | null = null;
  private isAttached = false;
  private suppressActive = false;
  private listeners: {
    show: (event: Event) => void;
    shown: (event: Event) => void;
    hide: (event: Event) => void;
    hidden: (event: Event) => void;
  } | null;
  private clickListener: ((event: Event) => void) | null;

  constructor(private element: HTMLElement) {
    this.listeners = {
      show: (event: Event) => this.handleShow(event),
      shown: (event: Event) => this.handleShown(event),
      hide: (event: Event) => this.handleHide(event),
      hidden: (event: Event) => this.handleHidden(event),
    };
    this.clickListener = (event: Event) => this.handleClick(event);
  }

  attached() {
    this.createInstance();
    this.addListeners();
    this.isAttached = true;
    if (this.clickListener) {
      this.element.addEventListener("click", this.clickListener);
    }

    if (this.active || this.isActive()) {
      this.instance?.show();
    }
  }

  detached() {
    if (this.clickListener) {
      this.element.removeEventListener("click", this.clickListener);
    }
    this.removeListeners();
    this.disposeInstance();
    this.listeners = null;
    this.clickListener = null;
    this.isAttached = false;
  }

  activeChanged() {
    if (!this.isAttached || this.suppressActive) {
      this.suppressActive = false;
      return;
    }

    if (this.active) {
      this.instance?.show();
    }
  }

  addListeners() {
    if (!this.listeners) return;
    this.element.addEventListener("show.bs.tab", this.listeners.show);
    this.element.addEventListener("shown.bs.tab", this.listeners.shown);
    this.element.addEventListener("hide.bs.tab", this.listeners.hide);
    this.element.addEventListener("hidden.bs.tab", this.listeners.hidden);
  }

  removeListeners() {
    if (!this.listeners) return;
    this.element.removeEventListener("show.bs.tab", this.listeners.show);
    this.element.removeEventListener("shown.bs.tab", this.listeners.shown);
    this.element.removeEventListener("hide.bs.tab", this.listeners.hide);
    this.element.removeEventListener("hidden.bs.tab", this.listeners.hidden);
  }

  createInstance() {
    this.instance = new Tab(this.element);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }

  isActive() {
    return this.element.classList.contains("active");
  }

  handleClick(event: Event) {
    if (this.element.hasAttribute("data-bs-toggle")) {
      return;
    }

    event.preventDefault();
    this.instance?.show();
  }

  private handleShow(event: Event) {
    if (typeof this.onShow === "function") {
      this.onShow({ event });
    }
  }

  private handleShown(event: Event) {
    this.suppressActive = true;
    this.active = true;

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
    this.suppressActive = true;
    this.active = false;

    if (typeof this.onHidden === "function") {
      this.onHidden({ event });
    }
  }
}
