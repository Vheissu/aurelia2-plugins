import { INode, bindable, BindingMode, inject } from "aurelia";
import { Modal } from "bootstrap";
import { OverlayLifecycle } from "../utils/overlay-lifecycle.js";

type ModalOptions = ConstructorParameters<typeof Modal>[1];

interface ModalEventCallbackPayload {
  event: Event;
}

@inject(INode)
export class AubsModalCustomAttribute {
  @bindable options: ModalOptions;
  @bindable({ mode: BindingMode.twoWay }) isOpen = false;
  @bindable onShow: ((payload: ModalEventCallbackPayload) => void) | undefined;
  @bindable onShown: ((payload: ModalEventCallbackPayload) => void) | undefined;
  @bindable onHide: ((payload: ModalEventCallbackPayload) => void) | undefined;
  @bindable onHidden: ((payload: ModalEventCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Modal> | null = null;
  private readonly lifecycle: OverlayLifecycle;
  private retiring?: Promise<void>;
  private isAttached = false;
  private suppressToggle = false;

  private listeners: {
    show: (event: Event) => void;
    shown: (event: Event) => void;
    hide: (event: Event) => void;
    hidden: (event: Event) => void;
  } | null;

  constructor(private element: HTMLElement) {
    this.lifecycle = new OverlayLifecycle(element, "modal");
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

  detaching(): void | Promise<void> {
    this.isAttached = false;
    this.suppressToggle = false;
    const retire = this.disposeInstance();
    if (retire) return retire.finally(() => this.removeListeners());
    this.removeListeners();
  }

  optionsChanged(): void {
    if (!this.isAttached || this.retiring) return;

    const recreate = () => {
      if (!this.isAttached) return;
      this.createInstance();
      if (this.isOpen) this.instance?.show();
    };
    const retire = this.disposeInstance();
    if (retire) void retire.then(recreate);
    else recreate();
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
    this.element.addEventListener("show.bs.modal", this.listeners.show);
    this.element.addEventListener("shown.bs.modal", this.listeners.shown);
    this.element.addEventListener("hide.bs.modal", this.listeners.hide);
    this.element.addEventListener("hidden.bs.modal", this.listeners.hidden);
  }

  removeListeners() {
    if (!this.listeners) return;
    this.element.removeEventListener("show.bs.modal", this.listeners.show);
    this.element.removeEventListener("shown.bs.modal", this.listeners.shown);
    this.element.removeEventListener("hide.bs.modal", this.listeners.hide);
    this.element.removeEventListener("hidden.bs.modal", this.listeners.hidden);
  }

  createInstance() {
    this.instance = new Modal(this.element, this.options ?? undefined);
  }

  disposeInstance(): void | Promise<void> {
    if (this.retiring) return this.retiring;
    const instance = this.instance;
    this.instance = null;
    if (!instance) return;

    const close = this.lifecycle.close(() => instance.hide());
    if (close) {
      this.retiring = close.finally(() => {
        this.retiring = undefined;
        instance.dispose();
      });
      return this.retiring;
    }
    instance.dispose();
  }

  private handleShow(event: Event) {
    if (event.target !== this.element) return;
    this.lifecycle.begin("show", event);
    if (!this.isAttached || !this.instance) return;
    if (typeof this.onShow === "function") {
      this.onShow({ event });
    }
  }

  private handleShown(event: Event) {
    if (event.target !== this.element) return;
    this.lifecycle.complete("show");
    if (!this.isAttached || !this.instance) return;
    this.suppressToggle = true;
    this.isOpen = true;

    if (typeof this.onShown === "function") {
      this.onShown({ event });
    }
  }

  private handleHide(event: Event) {
    if (event.target !== this.element) return;
    this.lifecycle.begin("hide", event);
    if (!this.isAttached || !this.instance) return;
    if (typeof this.onHide === "function") {
      this.onHide({ event });
    }
  }

  private handleHidden(event: Event) {
    if (event.target !== this.element) return;
    this.lifecycle.complete("hide");
    if (!this.isAttached || !this.instance) return;
    this.suppressToggle = true;
    this.isOpen = false;

    if (typeof this.onHidden === "function") {
      this.onHidden({ event });
    }
  }
}
