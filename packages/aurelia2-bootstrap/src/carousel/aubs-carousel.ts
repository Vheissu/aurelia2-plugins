import { INode, bindable, BindingMode, inject } from "aurelia";
import { Carousel } from "bootstrap";

@inject(INode)
export class AubsCarouselCustomAttribute {
  @bindable options;
  @bindable({ mode: BindingMode.twoWay }) active = 0;
  @bindable onSlide;
  @bindable onSlid;

  instance;
  isAttached = false;
  suppressActive = false;
  listeners;

  constructor(private element: HTMLElement) {
    this.listeners = {
      slide: (event) => this.handleSlide(event),
      slid: (event) => this.handleSlid(event),
    };
  }

  attached() {
    this.createInstance();
    this.addListeners();
    this.isAttached = true;

    if (this.hasActive()) {
      this.instance?.to(this.active);
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

    const activeIndex = this.active;
    this.removeListeners();
    this.disposeInstance();
    this.createInstance();
    this.addListeners();

    if (this.hasActive()) {
      this.instance?.to(activeIndex);
    }
  }

  activeChanged() {
    if (!this.isAttached || this.suppressActive) {
      this.suppressActive = false;
      return;
    }

    if (this.hasActive()) {
      this.instance?.to(this.active);
    }
  }

  hasActive() {
    return typeof this.active === "number" && !isNaN(this.active);
  }

  addListeners() {
    this.element.addEventListener("slide.bs.carousel", this.listeners.slide);
    this.element.addEventListener("slid.bs.carousel", this.listeners.slid);
  }

  removeListeners() {
    this.element.removeEventListener("slide.bs.carousel", this.listeners.slide);
    this.element.removeEventListener("slid.bs.carousel", this.listeners.slid);
  }

  createInstance() {
    this.instance = new Carousel(this.element, this.options ?? undefined);
  }

  disposeInstance() {
    if (this.instance?.dispose) {
      this.instance.dispose();
    }
    this.instance = null;
  }

  handleSlide(event) {
    if (typeof this.onSlide === "function") {
      const index = typeof event?.to === "number" ? event.to : null;
      this.onSlide({ event, index });
    }
  }

  handleSlid(event) {
    if (typeof event?.to === "number") {
      this.suppressActive = true;
      this.active = event.to;
    }

    if (typeof this.onSlid === "function") {
      const index = typeof event?.to === "number" ? event.to : null;
      this.onSlid({ event, index });
    }
  }
}
