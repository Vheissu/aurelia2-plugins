import { INode, bindable, BindingMode, inject } from "aurelia";
import { Dropdown } from "bootstrap";
import { bootstrapOptions } from "../utils/bootstrap-options";

@inject(INode)
export class AubsDropdownCustomAttribute {
  @bindable options;
  @bindable({ mode: BindingMode.twoWay }) isOpen;
  @bindable autoClose: string | boolean = bootstrapOptions.dropdownAutoClose;
  @bindable onShow;
  @bindable onShown;
  @bindable onHide;
  @bindable onHidden;
  @bindable onToggle;

  instance;
  toggleElement;
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
    this.toggleElement?.addEventListener("show.bs.dropdown", this.listeners.show);
    this.toggleElement?.addEventListener("shown.bs.dropdown", this.listeners.shown);
    this.toggleElement?.addEventListener("hide.bs.dropdown", this.listeners.hide);
    this.toggleElement?.addEventListener("hidden.bs.dropdown", this.listeners.hidden);
  }

  removeListeners() {
    this.toggleElement?.removeEventListener("show.bs.dropdown", this.listeners.show);
    this.toggleElement?.removeEventListener("shown.bs.dropdown", this.listeners.shown);
    this.toggleElement?.removeEventListener("hide.bs.dropdown", this.listeners.hide);
    this.toggleElement?.removeEventListener("hidden.bs.dropdown", this.listeners.hidden);
  }

  createInstance() {
    const options = { ...(this.options ?? {}) };
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
    if (typeof this.onToggle === "function") {
      this.onToggle({ open: true, event });
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
    if (typeof this.onToggle === "function") {
      this.onToggle({ open: false, event });
    }
  }

  getToggleElement() {
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

  getAutoCloseMode() {
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
