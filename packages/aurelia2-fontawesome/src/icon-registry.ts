import { DI } from '@aurelia/kernel';
import {
    library,
    type IconDefinition,
    type IconLookup,
    type IconName,
    type IconPrefix
} from '@fortawesome/fontawesome-svg-core';
import type { FontAwesomeIcons } from './configure';

export type FontAwesomeIconInput =
    | string
    | IconDefinition
    | IconLookup
    | [IconPrefix, IconName];

export interface IFontAwesomeIconRegistry extends FontAwesomeIconRegistry { }

export const IFontAwesomeIconRegistry = DI.createInterface<IFontAwesomeIconRegistry>(
    'IFontAwesomeIconRegistry',
    x => x.singleton(FontAwesomeIconRegistry)
);

export class FontAwesomeIconRegistry {
    private readonly aliases = new Map<string, IconLookup>();

    public register(icons: FontAwesomeIcons = []): void {
        const uniqueDefinitions = new Map<string, IconDefinition>();

        for (const [alias, definition] of enumerateIcons(icons)) {
            const lookup: IconLookup = {
                prefix: definition.prefix,
                iconName: definition.iconName
            };

            this.aliases.set(normalizeIconKey(definition.iconName), lookup);

            if (alias) {
                this.aliases.set(normalizeIconKey(alias), lookup);
            }

            uniqueDefinitions.set(`${definition.prefix}:${definition.iconName}`, definition);
        }

        if (uniqueDefinitions.size > 0) {
            library.add(...uniqueDefinitions.values());
        }
    }

    public resolve(iconValue: FontAwesomeIconInput): IconLookup {
        if (Array.isArray(iconValue)) {
            return {
                prefix: iconValue[0],
                iconName: iconValue[1]
            };
        }

        if (isIconDefinition(iconValue)) {
            return {
                prefix: iconValue.prefix,
                iconName: iconValue.iconName
            };
        }

        if (isIconLookup(iconValue)) {
            return iconValue;
        }

        const normalizedIcon = normalizeIconKey(iconValue);
        const lookup = this.aliases.get(normalizedIcon);

        if (lookup) {
            return lookup;
        }

        return {
            prefix: 'fas',
            iconName: normalizedIcon as IconName
        };
    }
}

function enumerateIcons(icons: FontAwesomeIcons): Array<[string | null, IconDefinition]> {
    if (Array.isArray(icons)) {
        return icons.map(iconDefinition => [iconDefinition.iconName, iconDefinition]);
    }

    return Object.entries(icons).map(([alias, iconDefinition]) => [alias, iconDefinition]);
}

function normalizeIconKey(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

function isIconDefinition(value: unknown): value is IconDefinition {
    return typeof value === 'object'
        && value !== null
        && 'prefix' in value
        && 'iconName' in value
        && 'icon' in value;
}

function isIconLookup(value: unknown): value is IconLookup {
    return typeof value === 'object'
        && value !== null
        && 'prefix' in value
        && 'iconName' in value
        && !('icon' in value);
}
