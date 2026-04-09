import { bootstrapOptions } from './bootstrap-options';

export type BootstrapOptions = typeof bootstrapOptions;

export class BootstrapConfig {
    private options: BootstrapOptions;

    constructor(){
        this.options = bootstrapOptions;
    }

}