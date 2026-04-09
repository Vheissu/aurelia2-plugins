import { INode, bindable, BindingMode, inject } from "aurelia";
import { Dropdown } from "bootstrap";
import { bootstrapOptions } from "../utils/bootstrap-options";

interface DropdownEventCallbackPayload {
  event: Event;
}

interface DropdownToggleCallbackPayload {
  open: boolean;
  event: Event;
}

@inject(INode)
export class AubsDropdownCustomAttribute {
  @bindable options: Record<string, unknown>;
  @bindable({ mode: BindingMode.twoWay }) isOpen: boolean | undefined;
  @bindable autoClose: string | boolean = bootstrapOptions.dropdownAutoClose;
  @bindable onShow: ((payload: DropdownEventCallbackPayload) => void) | undefined;
  @bindable onShown: ((payload: DropdownEventCallbackPayload) => void) | undefined;
  @bindable onHide: ((payload: DropdownEventCallbackPayload) => void) | undefined;
  @bindable onHidden: ((payload: DropdownEventCallbackPayload) => void) | undefined;
  @bindable onToggle: ((payload: DropdownToggleCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Dropdown> | null = null;
  private toggleElement: HTMLElement | null = null;
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
    this.toggleElement = this.getToggleElement();
    this.createInstance();
    this.addListeners();
    this.isAttached = true;

    if (this.isOpen === true) {
      this.instance?.show();
    } else if (this.isOpen === false) {
      this.instance?.hide();
    }
  }

  detached() {
    this.removeListeners();
    this.disposeInstance();
    this.listeners = null;
    this.toggleElement = null;
    this.isAttached = false;
  }

  autoCloseChanged() {
    if (!this.isAttached) {
      return;
    }

    this.recreateInstance();
  }

  optionsChanged() {
    if (!this.isAttached) {
      return;
    }

    this.recreateInstance();
  }

  isOpenChanged() {
    if (!this.isAttached || this.suppressToggle) {
      this.suppressToggle = false;
      return;
    }

    if (this.isOpen === true) {
      this.instance?.show();
    } else if (this.isOpen === false) {
      this.instance?.hide();
    }
  }

  toggle() {
    this.instance?.toggle();
  }

  recreateInstance() {
    const shouldBeOpen = this.isOpen;
    this.removeListeners();
    this.disposeInstance();
    this.createInstance();
    this.addListeners();

    if (shouldBeOpen === true) {
      this.instance?.show();
    } else if (shouldBeOpen === false) {
      this.instance?.hide();
    }
  }

  addListeners() {
    if (!this.listeners || !this.toggleElement) return;
    this.toggleElement.addEventListener("show.bs.dropdown", this.listeners.show);
    this.toggleElement.addEventListener("shown.bs.dropdown", this.listeners.shown);
    this.toggleElement.addEventListener("hide.bs.dropdown", this.listeners.hide);
    this.toggleElement.addEventListener("hidden.bs.dropdown", this.listeners.hidden);
  }

  removeListeners() {
    if (!this.listeners || !this.toggleElement) return;
    this.toggleElement.removeEventListener("show.bs.dropdown", this.listeners.show);
    this.toggleElement.removeEventListener("shown.bs.dropdown", this.listeners.shown);
    this.toggleElement.removeEventListener("hide.bs.dropdown", this.listeners.hide);
    this.toggleElement.removeEventListener("hidden.bs.dropdown", this.listeners.hidden);
  }

  createInstance() {
    if (!this.toggleElement) return;
    const options = { ...(this.options ?? {}) } as Record<string, unknown>;
    if (options.autoClose === undefined) {
      options.autoClose = this.getAutoCloseMode();
    }
    this.instance = new Dropdown(this.toggleElement, options);
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
    if (typeof this.onToggle === "function") {
      this.onToggle({ open: true, event });
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
    if (typeof this.onToggle === "function") {
      this.onToggle({ open: false, event });
    }
  }

  getToggleElement(): HTMLElement {
    if (this.toggleElement) {
      return this.toggleElement;
    }

    if (
      this.element.matches(".dropdown-toggle") ||
      this.element.hasAttribute("data-bs-toggle")
    ) {
      return this.element;
    }

    const toggle = this.element.querySelector<HTMLElement>(
      '[data-bs-toggle="dropdown"], .dropdown-toggle'
    );
    if (!toggle) {
      throw new Error(
        "The aubs-dropdown attribute requires a dropdown toggle element (with .dropdown-toggle or data-bs-toggle=\"dropdown\")."
      );
    }

    return toggle;
  }

  getAutoCloseMode(): boolean | "inside" | "outside" {
    if (this.autoClose === true || this.autoClose === "true" || this.autoClose === "always") {
      return true;
    }

    if (this.autoClose === false || this.autoClose === "false" || this.autoClose === "disabled") {
      return false;
    }

    if (this.autoClose === "inside" || this.autoClose === "outside") {
      return this.autoClose;
    }

    return true;
  }
}
