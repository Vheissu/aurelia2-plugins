import {INode} from "aurelia";
import {AubsDropdownCustomAttribute} from "./aubs-dropdown";

export class AubsDropdownToggleCustomAttribute {
    clickedListener;

    constructor(private dropdown: AubsDropdownCustomAttribute, @INode private element: HTMLElement){        
        this.clickedListener = () => this.dropdown.toggle();
    }

    attached() {
        this.element.addEventListener('click', this.clickedListener);
    }

    detached(){
        this.element.removeEventListener('click', this.clickedListener);
    }
}