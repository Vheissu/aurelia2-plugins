import { DI, IContainer, IRegistry } from '@aurelia/kernel';
import {AubsAccordionCustomElement} from "./accordion/aubs-accordion.js";
import {AubsAccordionGroupCustomElement} from "./accordion/aubs-accordion-group.js";
import {AubsBtnCheckboxCustomAttribute} from "./buttons/aubs-btn-checkbox.js";
import {AubsBtnLoadingCustomAttribute} from "./buttons/aubs-btn-loading.js";
import {AubsBtnRadioCustomAttribute} from "./buttons/aubs-btn-radio.js";
import {AubsCollapseCustomAttribute} from "./collapse/aubs-collapse.js";
import {AubsDropdownCustomAttribute} from "./dropdown/aubs-dropdown.js";
import {AubsDropdownToggleCustomAttribute} from "./dropdown/aubs-dropdown-toggle.js";
import {AubsPaginationCustomElement} from "./pagination/aubs-pagination.js";
import {AubsPopoverCustomAttribute} from "./popover/aubs-popover.js";
import {AubsTabCustomElement} from "./tabs/aubs-tab.js";
import {AubsTabsetCustomElement} from "./tabs/aubs-tabset.js";
import {AubsTooltipCustomAttribute} from "./tooltip/aubs-tooltip.js";
import {AubsTypeaheadCustomElement} from "./typeahead/aubs-typeahead.js";
import {TypeaheadHighlightValueConverter} from "./typeahead/typeahead-highlight.js";
import {BootstrapConfig} from "./utils/bootstrap-config.js";

export const DefaultComponents: IRegistry[] = [
    AubsAccordionCustomElement as unknown as IRegistry,
    AubsAccordionGroupCustomElement as unknown as IRegistry,
    AubsBtnCheckboxCustomAttribute as unknown as IRegistry,
    AubsBtnLoadingCustomAttribute as unknown as IRegistry,
    AubsBtnRadioCustomAttribute as unknown as IRegistry,
    AubsCollapseCustomAttribute as unknown as IRegistry,
    AubsDropdownCustomAttribute as unknown as IRegistry,
    AubsDropdownToggleCustomAttribute as unknown as IRegistry,
    AubsPaginationCustomElement as unknown as IRegistry,
    AubsPopoverCustomAttribute as unknown as IRegistry,
    AubsTabCustomElement as unknown as IRegistry,
    AubsTabsetCustomElement as unknown as IRegistry,
    AubsTooltipCustomAttribute as unknown as IRegistry,
    AubsTypeaheadCustomElement as unknown as IRegistry,
    TypeaheadHighlightValueConverter as unknown as IRegistry,
    BootstrapConfig as unknown as IRegistry,
];

function createBootstrapConfiguration(options) {
    return {
        register(container: IContainer) {
            if (options?.callback) {
                let config = new BootstrapConfig();
                
                options.callback(config);
            }

            return container.register(...DefaultComponents)
        },
        configure(options) {
            return createBootstrapConfiguration(options);
        }
    };
}

export const BootstrapConfiguration = createBootstrapConfiguration({});
