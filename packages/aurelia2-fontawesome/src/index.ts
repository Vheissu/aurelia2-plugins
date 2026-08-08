import { IContainer, IRegistry } from '@aurelia/kernel';
import { dom } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowDownShortWide,
    faArrowUpWideShort,
    faSort
} from '@fortawesome/free-solid-svg-icons';
import {
    Configure,
    IFontAwesomeConfiguration,
    type FontAwesomeConfigurationOptions,
    type FontAwesomeIcons
} from './configure';
import { AutSortIconCustomAttribute } from './aut-sort-icon-custom-attribute';
import { FontAwesomeIconCustomElement } from './font-awesome-icon-custom-element';
import { IFontAwesomeIconRegistry } from './icon-registry';

export { FontAwesomeIconCustomElement } from './font-awesome-icon-custom-element';
export { AutSortIconCustomAttribute } from './aut-sort-icon-custom-attribute';
export { Configure, defineIcons, IFontAwesomeConfiguration } from './configure';
export { FontAwesomeIconRegistry, IFontAwesomeIconRegistry } from './icon-registry';
export type { FontAwesomeConfigurationOptions, FontAwesomeIcons, FontAwesomeIconMap } from './configure';
export type { FontAwesomeIconInput } from './icon-registry';

const defaultSortIcons = [
    faSort,
    faArrowDownShortWide,
    faArrowUpWideShort
];

function registerPlugin(container: IContainer, options: FontAwesomeConfigurationOptions): void {
    if (options.injectStyles !== false) {
        dom.insertCss();
    }

    const resources: IRegistry[] = [
        FontAwesomeIconCustomElement as unknown as IRegistry
    ];

    if (options.registerSortAttribute !== false) {
        resources.push(AutSortIconCustomAttribute as unknown as IRegistry);
    }

    const iconRegistry = container.get(IFontAwesomeIconRegistry);
    const icons = options.registerDefaultSortIcons === false
        ? (options.icons ?? [])
        : mergeIcons(defaultSortIcons, options.icons);

    iconRegistry.register(icons);
    container.register(...resources);
}

function mergeIcons(defaultIcons: typeof defaultSortIcons, icons: FontAwesomeIcons | undefined): FontAwesomeIcons {
    if (!icons) {
        return [...defaultIcons];
    }

    if (Array.isArray(icons)) {
        return [...defaultIcons, ...icons];
    }

    return {
        sort: faSort,
        arrowDownShortWide: faArrowDownShortWide,
        arrowUpWideShort: faArrowUpWideShort,
        ...icons
    };
}

function createFontAwesomeConfiguration(options: Partial<FontAwesomeConfigurationOptions>) {
    return {
        register(container: IContainer) {
            const config = container.get(IFontAwesomeConfiguration);
            config.options(options);
            registerPlugin(container, config.getOptions());
        },
        configure(nextOptions: FontAwesomeConfigurationOptions) {
            return createFontAwesomeConfiguration(nextOptions);
        },
        customize(callback?: (config: Configure) => void) {
            return {
                register(container: IContainer) {
                    const config = container.get(IFontAwesomeConfiguration);
                    config.options(options);
                    callback?.(config);
                    registerPlugin(container, config.getOptions());
                },
                configure(nextOptions: FontAwesomeConfigurationOptions) {
                    return createFontAwesomeConfiguration(nextOptions);
                }
            };
        }
    };
}

export const FontAwesomeConfiguration = createFontAwesomeConfiguration({});
