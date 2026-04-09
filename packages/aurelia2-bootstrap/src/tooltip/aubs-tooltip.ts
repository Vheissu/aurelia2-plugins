import { bindable, inject, BindingMode, INode } from 'aurelia';
import {TooltipService} from '../utils/tooltip-service';
import {bootstrapOptions} from '../utils/bootstrap-options';
import type { Instance as PopperInstance } from '@popperjs/core';
import velocity from 'velocity-animate';

interface TooltipListeners {
    in: () => void;
    out: () => void;
    click: () => void;
    outside: (event: Event) => void;
}

@inject(INode, TooltipService)
export class AubsTooltipCustomAttribute {
    @bindable text: string = '';
    @bindable position = bootstrapOptions.tooltipPosition;
    @bindable disabled = false;
    @bindable({ mode: BindingMode.twoWay }) open = false;
    @bindable trigger = bootstrapOptions.tooltipTrigger;
    @bindable class = bootstrapOptions.tooltipClass;

    triggers: string[] = [];

    private validPositions = ['top', 'bottom', 'left', 'right', 'start', 'end'];
    private valuesChanged = false;
    private visible = false;
    private listeners: TooltipListeners | null;
    private isAttached = false;
    private tooltip: HTMLElement | null = null;
    private popper: PopperInstance | null = null;
    private body: HTMLElement | null = null;
    private showClass = 'show';

    constructor(private element: HTMLElement, private tooltipService: TooltipService) {
        this.listeners = {
            in: () => this.handleShow(),
            out: () => this.handleHide(),
            click: () => {
                this.visible ? this.handleHide() : this.handleShow()
            },
            outside: (event: Event) => this.handleOutside(event)
        };
    }

    bind() {
        if (!this.validPositions.includes(this.position)) {
            this.position = 'top';
        }

        this.triggers = this.trigger.split(' ');
    }

    attached() {
        if (this.listeners) {
            this.tooltipService.setTriggers(this.element, this.triggers, this.listeners);
        }

        this.isAttached = true;
        if (this.open) {
            this.handleShow();
        }
    }

    detached() {
        if (this.listeners) {
            this.tooltipService.removeTriggers(this.element, this.triggers, this.listeners);
        }

        if (this.tooltip && document.body.contains(this.tooltip)) {
            document.body.removeChild(this.tooltip);
        }

        if (this.popper) {
            this.popper.destroy();
        }

        this.tooltip = null;
        this.popper = null;
        this.body = null;
        this.listeners = null;
        this.isAttached = false;
    }

    openChanged() {
        if (!this.isAttached) {
            return;
        }

        if (this.open) {
            this.handleShow();
        } else {
            this.handleHide();
        }
    }

    triggerChanged() {
        if (this.listeners) {
            this.tooltipService.removeTriggers(this.element, this.triggers, this.listeners);
        }

        this.triggers = this.trigger.split(' ');
        if (this.listeners) {
            this.tooltipService.setTriggers(this.element, this.triggers, this.listeners);
        }
    }

    textChanged() {
        this.valuesChanged = true;

        if (this.body) {
            this.body.innerHTML = this.text;
        }
    }

    positionChanged(newValue: string, oldValue: string) {
        if (!this.validPositions.includes(newValue)) {
            this.position = oldValue;
            return;
        }

        this.valuesChanged = true;
    }

    handleShow() {
        if (this.visible || this.disabled) {
            return;
        }

        if (!this.tooltip || this.valuesChanged) {
            this.createTooltip();
            this.valuesChanged = false;
        }

        if (!this.tooltip) return;

        this.tooltip.style.display = 'block';
        void this.popper?.update();

        const tooltipEl = this.tooltip;
        velocity(tooltipEl, 'stop')
            .then(() => {
                velocity(tooltipEl, 'fadeIn').then(() => {
                    tooltipEl.classList.add(this.showClass);
                });
            });


        this.visible = true;
        this.open = true;
    }

    handleHide() {
        if (!this.visible || !this.tooltip) {
            return;
        }

        const tooltipEl = this.tooltip;
        velocity(tooltipEl, 'stop').then(() => {
            velocity(tooltipEl, 'fadeOut').then(() => {
                tooltipEl.classList.remove(this.showClass);
            });
        });

        this.visible = false;
        this.open = false;
    }

    handleOutside(event: Event) {
        if (this.element !== event.target) {
            this.handleHide();
        }
    }

    createTooltip() {
        if (this.tooltip && document.body.contains(this.tooltip)) {
            document.body.removeChild(this.tooltip);
        }

        const tooltipEl = document.createElement('div');
        this.tooltip = tooltipEl;
        this.parseClassList().forEach(next => tooltipEl.classList.add(next.trim()));

        tooltipEl.classList.add(this.getPlacementClass(this.position));
        tooltipEl.setAttribute('role', 'tooltip');

        const arrow = document.createElement('div');
        arrow.classList.add('tooltip-arrow');
        tooltipEl.appendChild(arrow);

        this.body = document.createElement('div');
        this.body.classList.add('tooltip-inner');
        this.body.innerHTML = this.text;
        tooltipEl.appendChild(this.body);

        document.body.appendChild(tooltipEl);

        if (this.popper) {
            this.popper.destroy();
        }

        this.popper = this.tooltipService.createAttachment(this.element, tooltipEl, this.position);
    }

    parseClassList() {
        const classes = new Set<string>(['tooltip']);
        if (this.class && this.class.length > 0) {
            this.class.split(',').forEach(next => classes.add(next.trim()));
        }
        return Array.from(classes);
    }

    getPlacementClass(position: string) {
        if (position === 'left') {
            return 'bs-tooltip-start';
        }

        if (position === 'right') {
            return 'bs-tooltip-end';
        }

        if (position === 'start') {
            return 'bs-tooltip-start';
        }

        if (position === 'end') {
            return 'bs-tooltip-end';
        }

        return `bs-tooltip-${position}`;
    }

}
