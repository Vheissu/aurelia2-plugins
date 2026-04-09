import { bindable, BindingMode } from "aurelia";
import {bootstrapOptions} from "../utils/bootstrap-options";
import type { AubsTabCustomElement } from "./aubs-tab";

export class AubsTabsetCustomElement {
    @bindable type = bootstrapOptions.tabsetType;
    @bindable vertical = bootstrapOptions.tabsetVertical;
    @bindable({ mode: BindingMode.twoWay }) active = 0;
    tabs: AubsTabCustomElement[] = [];

    tabsClass = 'nav-tabs';

    bound(){
        this.typeChanged();
    }

    typeChanged(){
        this.tabsClass = this.type === 'pills' ? 'nav-pills' : 'nav-tabs';
    }

    activeChanged(newValue: number){

        if(!this.tabs || this.tabs.length == 0) {
            return;
        }

        if(newValue > this.tabs.length){
            this.active = 0;
            return;
        }

        this.selectTab(this.tabs[this.active], true);
    }

    tabsChanged() {
        if (!this.tabs || this.tabs.length === 0) {
            return;
        }

        for(let i = 0; i < this.tabs.length; i++){
            let next = this.tabs[i];
            next.index = i;
        }

        if(this.active >= this.tabs.length){
            this.active = 0;
        }

        this.selectTab(this.tabs[this.active]);
    }

    registerTab(tab: AubsTabCustomElement) {
        if (!this.tabs.includes(tab)) {
            this.tabs.push(tab);
            this.tabsChanged();
        }
    }

    unregisterTab(tab: AubsTabCustomElement) {
        const index = this.tabs.indexOf(tab);
        if (index >= 0) {
            this.tabs.splice(index, 1);
            this.tabsChanged();
        }
    }

    selectTab(tab: AubsTabCustomElement | undefined, force = false) {
        if (!tab) {
            return;
        }

        if (tab.disabled && !force) {
            return;
        }

        this.active = tab.index;

        this.emitTabChanged();
    }

    emitTabChanged() {
        for (let next of this.tabs) {
            next.handleTabChanged(this.active);
        }
    }
}
