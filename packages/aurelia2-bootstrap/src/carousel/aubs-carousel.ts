import { INode, bindable, BindingMode, inject } from "aurelia";
import { Carousel } from "bootstrap";

type CarouselOptions = ConstructorParameters<typeof Carousel>[1];

interface CarouselSlideCallbackPayload {
  event: Event;
  index: number | null;
}

@inject(INode)
export class AubsCarouselCustomAttribute {
  @bindable options: CarouselOptions;
  @bindable({ mode: BindingMode.twoWay }) active = 0;
  @bindable onSlide: ((payload: CarouselSlideCallbackPayload) => void) | undefined;
  @bindable onSlid: ((payload: CarouselSlideCallbackPayload) => void) | undefined;

  private instance: InstanceType<typeof Carousel> | null = null;
  private isAttached = false;
  private suppressActive = false;
  private listeners: {
    slide: (event: Event) => void;
    slid: (event: Event) => void;
  } | null;

  constructor(private element: HTMLElement) {
    this.listeners = {
      slide: (event: Event) => this.handleSlide(event),
      slid: (event: Event) => this.handleSlid(event),
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
    this.listeners = null;
    this.isAttached = false;
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
    if (!this.listeners) return;
    this.element.addEventListener("slide.bs.carousel", this.listeners.slide);
    this.element.addEventListener("slid.bs.carousel", this.listeners.slid);
  }

  removeListeners() {
    if (!this.listeners) return;
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

  private handleSlide(event: Event) {
    if (typeof this.onSlide === "function") {
      const bsEvent = event as Event & { to?: number };
      const index = typeof bsEvent.to === "number" ? bsEvent.to : null;
      this.onSlide({ event, index });
    }
  }

  private handleSlid(event: Event) {
    const bsEvent = event as Event & { to?: number };
    if (typeof bsEvent.to === "number") {
      this.suppressActive = true;
      this.active = bsEvent.to;
    }

    if (typeof this.onSlid === "function") {
      const index = typeof bsEvent.to === "number" ? bsEvent.to : null;
      this.onSlid({ event, index });
    }
  }
}
