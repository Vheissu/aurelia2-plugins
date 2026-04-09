import { INode, bindable, BindingMode, inject } from "aurelia";
import { Collapse } from "bootstrap";

interface CollapseEventCallbackPayload {
  event: Event;
}

@inject(INode)
export class AubsCollapseCustomAttribute {
  @bindable options: Record<string, unknown>;
  @bindable({ mode: BindingMode.twoWay }) collapsed: boolean | undefined;
  @bindable onShow: ((payload: CollapseEventCallbackPayload) => void) | undefined;
  @bindable onShown: ((payload: CollapseEventCallbackPayload) => void) | undefined;
  @bindable onHide: ((payload: CollapseEventCallbackPayload) => void) | undefined;
  @bindable onHidden: ((payload: CollapseEventCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Collapse> | null = null;
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

    this.syncFromCollapsed();
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

    const shouldBeCollapsed = this.collapsed;
    this.removeListeners();
    this.disposeInstance();
    this.createInstance();
    this.addListeners();

    this.syncFromCollapsed(shouldBeCollapsed);
  }

  collapsedChanged() {
    if (!this.isAttached || this.suppressToggle) {
      this.suppressToggle = false;
      return;
    }

    if (this.collapsed === true) {
      this.instance?.hide();
    } else if (this.collapsed === false) {
      this.instance?.show();
    }
  }

  syncFromCollapsed(value = this.collapsed) {
    if (value === true) {
      this.instance?.hide();
    } else if (value === false) {
      this.instance?.show();
    }
  }

  addListeners() {
    if (!this.listeners) return;
    this.element.addEventListener("show.bs.collapse", this.listeners.show);
    this.element.addEventListener("shown.bs.collapse", this.listeners.shown);
    this.element.addEventListener("hide.bs.collapse", this.listeners.hide);
    this.element.addEventListener("hidden.bs.collapse", this.listeners.hidden);
  }

  removeListeners() {
    if (!this.listeners) return;
    this.element.removeEventListener("show.bs.collapse", this.listeners.show);
    this.element.removeEventListener("shown.bs.collapse", this.listeners.shown);
    this.element.removeEventListener("hide.bs.collapse", this.listeners.hide);
    this.element.removeEventListener("hidden.bs.collapse", this.listeners.hidden);
  }

  createInstance() {
    const options = { ...(this.options ?? {}) };
    if (options.toggle == null) {
      options.toggle = false;
    }
    this.instance = new Collapse(this.element, options);
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
    this.collapsed = false;

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
    this.collapsed = true;

    if (typeof this.onHidden === "function") {
      this.onHidden({ event });
    }
  }
}
