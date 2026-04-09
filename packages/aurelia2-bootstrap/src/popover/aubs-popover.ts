import { bindable, BindingMode, INode, inject } from "aurelia";
import { ITooltipService } from "../utils/tooltip-service";
import { bootstrapOptions } from "../utils/bootstrap-options";
import type { Instance as PopperInstance } from "@popperjs/core";
import velocity from "velocity-animate";

interface PopoverListeners {
  in: () => void;
  out: () => void;
  click: () => void;
  outside: (event: Event) => void;
}

interface PopoverToggleCallbackPayload {
  open: boolean;
}

@inject(INode, ITooltipService)
export class AubsPopoverCustomAttribute {
  @bindable title: string = '';
  @bindable body: string = '';
  @bindable position = bootstrapOptions.popoverPosition;
  @bindable disabled = false;
  @bindable({ mode: BindingMode.twoWay }) isOpen = false;
  @bindable trigger = bootstrapOptions.popoverTrigger;
  @bindable customPopover: HTMLElement | null = null;
  @bindable onToggle: ((payload: PopoverToggleCallbackPayload) => void) | undefined;

  triggers: string[] = [];

  private validPositions = ["top", "bottom", "left", "right", "start", "end"];
  private valuesChanged = false;
  private visible = false;
  private listeners: PopoverListeners | null;
  private isAttached = false;

  private popover: HTMLElement | null = null;
  private popper: PopperInstance | null = null;
  private titleElement: HTMLElement | null = null;
  private bodyElement: HTMLElement | null = null;
  private oldPosition: string | null = null;

  private showClass = "show";

  constructor(
    private element: HTMLElement,
    private tooltipService: ITooltipService
  ) {
    this.listeners = {
      in: () => this.handleShow(),
      out: () => this.handleHide(),
      click: () => {
        this.visible ? this.handleHide() : this.handleShow();
      },
      outside: (event: Event) => this.handleOutside(event),
    };
  }

  bind() {
    if (!this.validPositions.includes(this.position)) {
      this.position = "top";
    }

    this.triggers = this.trigger.split(" ");

    this.showClass = "show";
  }

  attached() {
    if (this.listeners) {
      this.tooltipService.setTriggers(
        this.element,
        this.triggers,
        this.listeners
      );
    }

    if (this.customPopover) {
      this.customPopover.style.display = "none";
    }

    this.isAttached = true;
    if (this.isOpen) {
      this.handleShow();
    }
  }

  detached() {
    if (this.listeners) {
      this.tooltipService.removeTriggers(
        this.element,
        this.triggers,
        this.listeners
      );
    }

    if (this.popover && document.body.contains(this.popover)) {
      if (!this.customPopover) {
        document.body.removeChild(this.popover);
      } else {
        this.popover.style.display = "none";
      }
    }

    if (this.popper) {
      this.popper.destroy();
    }

    this.popover = null;
    this.popper = null;
    this.titleElement = null;
    this.bodyElement = null;
    this.listeners = null;
    this.isAttached = false;
  }

  isOpenChanged() {
    if (!this.isAttached) {
      return;
    }

    if (this.isOpen) {
      this.handleShow();
    } else {
      this.handleHide();
    }
  }

  titleChanged() {
    this.valuesChanged = true;

    if (this.titleElement) {
      this.titleElement.innerHTML = this.title;
    }
  }

  bodyChanged() {
    this.valuesChanged = true;

    if (this.bodyElement) {
      this.bodyElement.innerHTML = this.body;
    }
  }

  positionChanged(newValue: string, oldValue: string) {
    if (!this.validPositions.includes(newValue)) {
      this.position = oldValue;
      return;
    }
    this.oldPosition = oldValue;

    this.valuesChanged = true;
  }

  triggerChanged(_newValue: string, _oldValue: string) {
    if (this.listeners) {
      this.tooltipService.removeTriggers(
        this.element,
        this.triggers,
        this.listeners
      );
    }

    this.triggers = this.trigger.split(" ");
    if (this.listeners) {
      this.tooltipService.setTriggers(
        this.element,
        this.triggers,
        this.listeners
      );
    }
  }

  handleShow() {
    if (this.visible || this.disabled) {
      return;
    }

    if (!this.popover || this.valuesChanged) {
      this.createPopover();
      this.valuesChanged = false;
    }

    if (!this.popover) return;

    if (this.customPopover) {
      if (this.popper) {
        this.popper.destroy();
      }

      this.popper = this.tooltipService.createAttachment(
        this.element,
        this.popover,
        this.position
      );
    }

    this.popover.style.display = "block";
    void this.popper?.update();

    const popoverEl = this.popover;
    velocity(popoverEl, "stop").then(() => {
      velocity(popoverEl, "fadeIn").then(() => {
        popoverEl.classList.add(this.showClass);

        if (typeof this.onToggle === "function") {
          this.onToggle({ open: true });
        }
      });
    });

    this.visible = true;
    this.isOpen = true;
  }

  handleHide() {
    if (!this.visible || !this.popover) {
      return;
    }

    const popoverEl = this.popover;
    velocity(popoverEl, "stop").then(() => {
      velocity(popoverEl, "fadeOut").then(() => {
        popoverEl.classList.remove(this.showClass);

        if (typeof this.onToggle === "function") {
          this.onToggle({ open: false });
        }
      });
    });

    this.visible = false;
    this.isOpen = false;
  }

  handleOutside(event: Event) {
    if (!this.visible) {
      return;
    }

    const target = event.target as Node;
    if (this.element !== target && !this.popover?.contains(target)) {
      this.handleHide();
    }
  }

  getPositionClass(position: string) {
    if (position === "left" || position === "start") {
      return "bs-popover-start";
    }

    if (position === "right" || position === "end") {
      return "bs-popover-end";
    }

    return `bs-popover-${position}`;
  }

  createPopover() {
    let arrow = document.createElement("div");
    arrow.classList.add("popover-arrow");

    if (this.customPopover) {
      this.popover = this.customPopover;

      if (this.oldPosition) {
        this.popover.classList.remove(this.getPositionClass(this.oldPosition));
      }

      this.popover.classList.add("popover");
      this.popover.classList.add(this.getPositionClass(this.position));
      this.popover.setAttribute("role", "tooltip");

      if (!this.popover.querySelector(".popover-arrow")) {
        this.popover.appendChild(arrow);
      }
    } else {
      if (this.popover && document.body.contains(this.popover)) {
        document.body.removeChild(this.popover);
      }

      this.popover = document.createElement("div");
      this.popover.classList.add("popover");
      this.popover.classList.add(this.getPositionClass(this.position));
      this.popover.setAttribute("role", "tooltip");

      this.popover.appendChild(arrow);

      if (this.title) {
        this.titleElement = document.createElement("h3");
        this.titleElement.classList.add("popover-header");
        this.titleElement.innerHTML = this.title;
        this.popover.appendChild(this.titleElement);
      }

      this.bodyElement = document.createElement("div");
      this.bodyElement.classList.add("popover-body");
      this.bodyElement.innerHTML = this.body;
      this.popover.appendChild(this.bodyElement);

      document.body.appendChild(this.popover);

      if (this.popper) {
        this.popper.destroy();
      }

      this.popper = this.tooltipService.createAttachment(
        this.element,
        this.popover,
        this.position
      );
    }
  }
}
