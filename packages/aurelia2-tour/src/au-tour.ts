import { bindable, BindingMode, customElement, INode, resolve } from 'aurelia';
import { ITourService } from './tour-service';
import type { TourDispose, TourPlacement, TourState, TourStep } from './types';
import template from './au-tour.html';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-tour',
  template,
})
export class AuTourCustomElement {
  @bindable({ set: identity }) public steps: TourStep[] = [];
  @bindable({ mode: BindingMode.twoWay }) public active = false;
  @bindable({ mode: BindingMode.twoWay }) public index = 0;

  public current: TourStep | null = null;
  public placement: TourPlacement = 'center';
  public cardStyle = '';
  public nextLabel = '';
  public previousLabel = '';
  public closeLabel = '';

  private readonly tour = resolve(ITourService);
  private readonly host = resolve(INode) as HTMLElement;
  private subscription: TourDispose | null = null;
  private highlightedTarget: Element | null = null;
  private syncingService = false;

  public binding(): void {
    const initialActive = this.active;
    const initialIndex = this.index;
    this.nextLabel = this.tour.options.nextLabel;
    this.previousLabel = this.tour.options.previousLabel;
    this.closeLabel = this.tour.options.closeLabel;
    this.subscription = this.tour.subscribe((state) => this.applyState(state));
    if (initialActive) {
      this.tour.start(this.steps, initialIndex);
    }
  }

  public detached(): void {
    this.clearHighlight();
    this.subscription?.dispose();
    this.subscription = null;
  }

  public activeChanged(): void {
    if (this.syncingService) return;
    if (this.active) {
      this.tour.start(this.steps, this.index);
    } else {
      this.tour.stop();
    }
  }

  public indexChanged(): void {
    if (!this.syncingService && this.active) {
      this.tour.goTo(this.index);
    }
  }

  public stepsChanged(): void {
    if (this.active) {
      this.tour.start(this.steps, this.index);
    }
  }

  public next(): void {
    const wasLast = this.index >= this.steps.length - 1;
    this.tour.next();
    this.dispatch(wasLast ? 'tour-complete' : 'tour-next');
  }

  public previous(): void {
    this.tour.previous();
    this.dispatch('tour-previous');
  }

  public stop(): void {
    this.tour.stop();
    this.dispatch('tour-close');
  }

  private applyState(state: TourState): void {
    this.syncingService = true;
    this.active = state.active;
    this.index = state.index;
    this.current = state.current;
    this.syncingService = false;
    this.updateLabels();
    this.updateTarget();
  }

  private updateLabels(): void {
    const current = this.current;
    const isLast = this.index >= this.steps.length - 1;
    this.previousLabel = current?.previousLabel ?? this.tour.options.previousLabel;
    this.nextLabel = isLast
      ? current?.doneLabel ?? this.tour.options.doneLabel
      : current?.nextLabel ?? this.tour.options.nextLabel;
    this.closeLabel = this.tour.options.closeLabel;
  }

  private updateTarget(): void {
    this.clearHighlight();
    const target = resolveTarget(this.current?.target);
    this.placement = this.current?.placement ?? (target ? 'bottom' : 'center');

    if (!this.active || !target) {
      this.cardStyle = '';
      return;
    }

    target.setAttribute('data-au-tour-active', 'true');
    this.highlightedTarget = target;
    this.cardStyle = createCardStyle(target, this.placement);
  }

  private clearHighlight(): void {
    this.highlightedTarget?.removeAttribute('data-au-tour-active');
    this.highlightedTarget = null;
  }

  private dispatch(name: string): void {
    this.host.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: {
        index: this.index,
        step: this.current,
      },
    }));
  }
}

function resolveTarget(target: string | Element | null | undefined): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  return document.querySelector(target);
}

function createCardStyle(target: Element, placement: TourPlacement): string {
  const rect = target.getBoundingClientRect();
  const gap = 12;
  const left = Math.max(16, rect.left);
  const top = Math.max(16, rect.bottom + gap);

  if (placement === 'top') {
    return `left: ${left}px; top: ${Math.max(16, rect.top - 180 - gap)}px;`;
  }

  if (placement === 'left') {
    return `left: ${Math.max(16, rect.left - 400 - gap)}px; top: ${Math.max(16, rect.top)}px;`;
  }

  if (placement === 'right') {
    return `left: ${Math.max(16, rect.right + gap)}px; top: ${Math.max(16, rect.top)}px;`;
  }

  if (placement === 'center') {
    return '';
  }

  return `left: ${left}px; top: ${top}px;`;
}
