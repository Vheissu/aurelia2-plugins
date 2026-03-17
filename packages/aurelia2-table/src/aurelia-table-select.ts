import { bindable, BindingMode, customAttribute, CustomAttribute, watch } from 'aurelia';
import { AureliaTableCustomAttribute } from './aurelia-table-attribute.js';

@customAttribute('aut-select')
export class AutSelectCustomAttribute {
  @bindable({mode: BindingMode.twoWay}) row;
  @bindable mode = 'single';
  @bindable selectedClass = 'aut-row-selected';
  @bindable custom = false;

  private rowSelectedListener;
  private element!: HTMLElement;
  private controller: any;
  private auTable: AureliaTableCustomAttribute | null = null;

  constructor() {
    this.rowSelectedListener = event => {
      this.handleRowSelected(event);
    };
  }

  created(controller) {
    this.controller = controller;
    this.element = controller.host as HTMLElement;
  }

  resolveTable() {
    let currentController = this.controller?.parent;
    while (currentController != null) {
      if (currentController.viewModel instanceof AureliaTableCustomAttribute) {
        this.auTable = currentController.viewModel;
        return;
      }
      currentController = currentController.parent;
    }

    const tableElement = this.element?.closest('table');
    const tableController = tableElement
      ? CustomAttribute.for(tableElement, 'aurelia-table')
      : null;

    this.auTable = tableController?.viewModel as AureliaTableCustomAttribute | null
      ?? CustomAttribute.closest(this.element, AureliaTableCustomAttribute)?.viewModel as AureliaTableCustomAttribute | null;
  }

  attached() {
    this.resolveTable();

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

    this.auTable = null;
    this.controller = null;
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
    if (!this.row) {
      return;
    }

    const source = event.target || event.srcElement;
    if (!(source instanceof HTMLElement) || !source.closest('td')) {
      return;
    }
    this.row.$isSelected = this.row.$isSelected ? false : true;
  }

  dispatchSelectedEvent() {
    this.element?.dispatchEvent(new CustomEvent('select', {
      detail: { row: this.row },
      bubbles: true
    }));
  }

  @watch((x: AutSelectCustomAttribute) => x.row?.$isSelected)
  isSelectedChanged() {
    if (!this.row) {
      return;
    }

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

  rowChanged() {
    this.setClass();
  }
}
