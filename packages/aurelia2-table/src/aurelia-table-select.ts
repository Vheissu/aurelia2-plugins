import { bindable, BindingMode, customAttribute, CustomAttribute, watch, type IController } from 'aurelia';
import { AureliaTableCustomAttribute, type DefaultTableValue } from './aurelia-table-attribute.js';

interface SelectableRow {
  $isSelected?: boolean;
}

@customAttribute('aut-select')
export class AutSelectCustomAttribute<TRow extends object = DefaultTableValue> {
  @bindable({ mode: BindingMode.twoWay }) row?: TRow | null;
  @bindable mode = 'single';
  @bindable selectedClass = 'aut-row-selected';
  @bindable custom = false;

  private readonly rowSelectedListener = (event: MouseEvent) => this.handleRowSelected(event);
  private element!: HTMLElement;
  private controller?: IController;
  private auTable: AureliaTableCustomAttribute<TRow & SelectableRow> | null = null;

  created(controller: IController) {
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

    const table = tableController ?? CustomAttribute.closest(this.element, AureliaTableCustomAttribute);
    this.auTable = table === null ? null : table.viewModel as AureliaTableCustomAttribute<TRow & SelectableRow>;
  }

  attached() {
    this.resolveTable();

    if (!this.custom && this.element) {
      this.element.style.cursor = 'pointer';
      this.element.addEventListener('click', this.rowSelectedListener);
    }

    this.setClass();
  }

  detaching() {
    this.element?.removeEventListener('click', this.rowSelectedListener);

    this.auTable = null;
  }

  setClass() {
    if (!this.element) return;
    if (this.isSelected) {
      this.element.classList.add(this.selectedClass);
    } else {
      this.element.classList.remove(this.selectedClass);
    }
  }

  handleRowSelected(event: Event) {
    if (this.custom || !this.row) {
      return;
    }

    const source = event.target || event.srcElement;
    if (!(source instanceof HTMLElement) || !source.closest('td')) {
      return;
    }
    (this.row as SelectableRow).$isSelected = !this.isSelected;
  }

  dispatchSelectedEvent() {
    this.element?.dispatchEvent(new CustomEvent('select', {
      detail: { row: this.row },
      bubbles: true
    }));
  }

  private get isSelected() {
    return (this.row as SelectableRow | null | undefined)?.$isSelected;
  }

  @watch((x: AutSelectCustomAttribute) => x.isSelected)
  isSelectedChanged() {
    if (!this.row) {
      return;
    }

    this.setClass();

    if (this.isSelected) {
      if (this.mode === 'single') {
        this.deselectAll();
      }

      this.dispatchSelectedEvent();
    }
  }

  deselectAll() {
    this.auTable?.data?.forEach((item) => {
      if (item !== this.row) {
        item.$isSelected = false;
      }
    });
  }

  rowChanged() {
    this.setClass();
  }
}
