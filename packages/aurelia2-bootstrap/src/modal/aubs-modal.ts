import { INode, bindable, BindingMode, inject } from "aurelia";
import { Modal } from "bootstrap";

@inject(INode)
export class AubsModalCustomAttribute {
  @bindable options;
  @bindable({ mode: BindingMode.twoWay }) isOpen = false;
  @bindable onShow;
  @bindable onShown;
  @bindable onHide;
  @bindable onHidden;

  instance;
  isAttached = false;
  suppressToggle = false;

  listeners;

  constructor(private element: HTMLElement) {
    this.listeners = {
      show: (event) => this.handleShow(event),
      shown: (event) => this.handleShown(event),
      hide: (event) => this.handleHide(event),
      hidden: (event) => this.handleHidden(event),
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
    this.element.addEventListener("show.bs.modal", this.listeners.show);
    this.element.addEventListener("shown.bs.modal", this.listeners.shown);
    this.element.addEventListener("hide.bs.modal", this.listeners.hide);
    this.element.addEventListener("hidden.bs.modal", this.listeners.hidden);
  }

  removeListeners() {
    this.element.removeEventListener("show.bs.modal", this.listeners.show);
    this.element.removeEventListener("shown.bs.modal", this.listeners.shown);
    this.element.removeEventListener("hide.bs.modal", this.listeners.hide);
    this.element.removeEventListener("hidden.bs.modal", this.listeners.hidden);
  }

  createInstance() {
    this.instance = new Modal(this.element, this.options ?? undefined);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }

  handleShow(event) {
    if (typeof this.onShow === "function") {
      this.onShow({ event });
    }
  }

  handleShown(event) {
    this.suppressToggle = true;
    this.isOpen = true;

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
    this.suppressToggle = true;
    this.isOpen = false;

    if (typeof this.onHidden === "function") {
      this.onHidden({ event });
    }
  }
}
