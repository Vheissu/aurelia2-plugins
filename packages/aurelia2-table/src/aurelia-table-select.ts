import { bindable, BindingMode, customAttribute, INode, watch } from '@aurelia/runtime-html';
import { inject } from '@aurelia/kernel';
import { AureliaTableCustomAttribute } from './aurelia-table-attribute.js';

@customAttribute('aut-select')
@inject(AureliaTableCustomAttribute, INode)
export class AutSelectCustomAttribute {
  @bindable({mode: BindingMode.twoWay}) row;
  @bindable mode = 'single';
  @bindable selectedClass = 'aut-row-selected';
  @bindable custom = false;

  private rowSelectedListener;

  constructor(private auTable: AureliaTableCustomAttribute, private readonly element: HTMLElement) {
    this.rowSelectedListener = event => {
      this.handleRowSelected(event);
    };
  }

  attached() {
    if (!this.custom && this.element) {
      this.element.style.cursor = 'pointer';
      this.element.addEventListener('click', this.rowSelectedListener);
    }

    this.setClass();
  }

  detached() {
    if (!this.custom) {
      this.element?.removeEventListener('click', this.rowSelectedListener);
    }
  }

  setClass() {
    if (!this.element) return;
    if (this.row?.$isSelected) {
      this.element.classList.add(this.selectedClass);
    } else {
      this.element.classList.remove(this.selectedClass);
    }
  }

  handleRowSelected(event) {
    let source = event.target || event.srcElement;
    if (source.tagName.toLowerCase() !== 'td') {
      return;
    }
    this.row.$isSelected = this.row.$isSelected ? false : true;
  }

  dispatchSelectedEvent() {
    let selectedEvent;
    if (window.CustomEvent) {
      selectedEvent = new CustomEvent('select', {
        detail: {row: this.row},
        bubbles: true
      });
    } else {
      selectedEvent = document.createEvent('CustomEvent');
      selectedEvent.initCustomEvent('select', true, true, {
        detail: {row: this.row}
      });
    }
    this.element.dispatchEvent(selectedEvent);
  }

  @watch((x: AutSelectCustomAttribute) => x.row.$isSelected)
  isSelectedChanged() {
    this.setClass();

    if (this.row.$isSelected) {
      if (this.mode === 'single') {
        this.deselectAll();
      }

      this.dispatchSelectedEvent();
    }
  }

  deselectAll() {
    this.auTable?.data?.forEach((item: any) => {
      if (item !== this.row) {
        item.$isSelected = false;
      }
    });
  }
}
