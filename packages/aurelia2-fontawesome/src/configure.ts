import { DI } from '@aurelia/kernel';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type FontAwesomeIconMap = Record<string, IconDefinition>;
export type FontAwesomeIcons = IconDefinition[] | FontAwesomeIconMap;

export interface FontAwesomeConfigurationOptions {
    icons?: FontAwesomeIcons;
    injectStyles?: boolean;
    registerSortAttribute?: boolean;
    registerDefaultSortIcons?: boolean;
}

export interface IFontAwesomeConfiguration extends Configure { }

export const IFontAwesomeConfiguration = DI.createInterface<IFontAwesomeConfiguration>(
    'IFontAwesomeConfiguration',
    x => x.singleton(Configure)
);

export class Configure {
    protected _config: FontAwesomeConfigurationOptions = {
        icons: [],
        injectStyles: true,
        registerSortAttribute: true,
        registerDefaultSortIcons: true
    };

    public getOptions(): FontAwesomeConfigurationOptions {
        return this._config;
    }

    public options(obj: FontAwesomeConfigurationOptions = {}): void {
        this._config = {
            ...this._config,
            ...obj,
            icons: mergeIconOptions(this._config.icons, obj.icons)
        };
    }
}

export function defineIcons<TIcons extends FontAwesomeIcons>(icons: TIcons): TIcons {
    return icons;
}

function mergeIconOptions(
    currentIcons: FontAwesomeIcons | undefined,
    nextIcons: FontAwesomeIcons | undefined
): FontAwesomeIcons {
    if (!currentIcons) {
        return nextIcons ?? [];
    }

    if (!nextIcons) {
        return currentIcons;
    }

    if (Array.isArray(currentIcons) && Array.isArray(nextIcons)) {
        return [...currentIcons, ...nextIcons];
    }

    if (!Array.isArray(currentIcons) && !Array.isArray(nextIcons)) {
        return {
            ...currentIcons,
            ...nextIcons
        };
    }

    return nextIcons;
}
