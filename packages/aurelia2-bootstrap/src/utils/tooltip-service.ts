import { DI } from "aurelia";
import { createPopper, type Instance, type Placement } from "@popperjs/core";

export const ITooltipService = DI.createInterface<ITooltipService>("ITooltipService", (x) =>
  x.singleton(TooltipService)
);
export interface ITooltipService extends TooltipService {}

export class TooltipService {
  createAttachment(target: Element, element: HTMLElement, position: string): Instance {
    const normalizedPosition = position === "start" ? "left" : position === "end" ? "right" : position;
    const placement = this.getPlacement(normalizedPosition);
    const arrow = element.querySelector(".tooltip-arrow, .popover-arrow");
    const modifiers = [];

    if (arrow) {
      modifiers.push({ name: "arrow", options: { element: arrow } });
    }

    return createPopper(target, element, {
      placement,
      modifiers,
    });
  }

  setTriggers(element, triggers, listeners) {
    if (!triggers.includes("none")) {
      if (triggers.includes("mouseover") || triggers.includes("hover")) {
        element.addEventListener("mouseover", listeners.in);
        element.addEventListener("mouseleave", listeners.out);
      }

      if (triggers.includes("focus")) {
        element.addEventListener("focus", listeners.in);
        element.addEventListener("blur", listeners.out);
      }

      if (triggers.includes("click")) {
        element.addEventListener("click", listeners.click);
      } else if (triggers.includes("outsideClick")) {
        element.addEventListener("click", listeners.in);
        document.addEventListener("click", listeners.outside);
      }
    }
  }

  removeTriggers(element, triggers, listeners) {
    if (!triggers.includes("none")) {
      if (triggers.includes("mouseover") || triggers.includes("hover")) {
        element.removeEventListener("mouseover", listeners.in);
        element.removeEventListener("mouseleave", listeners.out);
      }

      if (triggers.includes("focus")) {
        element.removeEventListener("focus", listeners.in);
        element.removeEventListener("blur", listeners.out);
      }

      if (triggers.includes("click")) {
        element.removeEventListener("click", listeners.click);
      } else if (triggers.includes("outsideClick")) {
        element.removeEventListener("click", listeners.in);
        document.removeEventListener("click", listeners.outside);
      }
    }
  }

  private getPlacement(position: string): Placement {
    switch (position) {
    case "top":
    case "bottom":
    case "left":
    case "right":
      return position;
    default:
      return "top";
    }
  }
}
