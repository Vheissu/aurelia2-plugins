import { INode, bindable, BindingMode, inject } from "aurelia";
import { Tab } from "bootstrap";

@inject(INode)
export class AubsTabToggleCustomAttribute {
  @bindable({ mode: BindingMode.twoWay }) active = false;
  @bindable onShow;
  @bindable onShown;
  @bindable onHide;
  @bindable onHidden;

  instance;
  isAttached = false;
  suppressActive = false;
  listeners;
  clickListener;

  constructor(private element: HTMLElement) {
    this.listeners = {
      show: (event) => this.handleShow(event),
      shown: (event) => this.handleShown(event),
      hide: (event) => this.handleHide(event),
      hidden: (event) => this.handleHidden(event),
    };
    this.clickListener = (event: Event) => this.handleClick(event);
  }

  attached() {
    this.createInstance();
    this.addListeners();
    this.isAttached = true;
    this.element.addEventListener("click", this.clickListener);

    if (this.active || this.isActive()) {
      this.instance?.show();
    }
  }

  detached() {
    this.element.removeEventListener("click", this.clickListener);
    this.removeListeners();
    this.disposeInstance();
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
    this.element.addEventListener("show.bs.tab", this.listeners.show);
    this.element.addEventListener("shown.bs.tab", this.listeners.shown);
    this.element.addEventListener("hide.bs.tab", this.listeners.hide);
    this.element.addEventListener("hidden.bs.tab", this.listeners.hidden);
  }

  removeListeners() {
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

  handleShow(event) {
    if (typeof this.onShow === "function") {
      this.onShow({ event });
    }
  }

  handleShown(event) {
    this.suppressActive = true;
    this.active = true;

    if (typeof this.onShown === "function") {
      this.onShown({ event });
    }
  }

  handleHide(event) {
    if (typeof this.onHide === "function") {
      this.onHide({ event });
    }
  }

  handleHidden(event) {
    this.suppressActive = true;
    this.active = false;

    if (typeof this.onHidden === "function") {
      this.onHidden({ event });
    }
  }
}
