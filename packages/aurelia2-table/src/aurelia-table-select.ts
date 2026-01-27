import { bindable, BindingMode, customAttribute, CustomAttribute, INode, inject, optional, watch } from 'aurelia';
import { AureliaTableCustomAttribute } from './aurelia-table-attribute.js';

@customAttribute('aut-select')
@inject(optional(AureliaTableCustomAttribute), INode)
export class AutSelectCustomAttribute {
  @bindable({mode: BindingMode.twoWay}) row;
  @bindable mode = 'single';
  @bindable selectedClass = 'aut-row-selected';
  @bindable custom = false;

  private rowSelectedListener;

  constructor(
    private auTable: AureliaTableCustomAttribute | null,
    private readonly element: HTMLElement
  ) {
    this.rowSelectedListener = event => {
      this.handleRowSelected(event);
    };
  }

  attached() {
    if (!this.auTable) {
      this.auTable = CustomAttribute.closest(this.element, AureliaTableCustomAttribute)?.viewModel ?? null;
    }

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
