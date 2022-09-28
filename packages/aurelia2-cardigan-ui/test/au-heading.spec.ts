import { createFixture } from '@aurelia/testing';
import { CustomElement } from '@aurelia/runtime-html';
import { AuHeadingCustomElement } from './../src/components/au-heading';
import { bootstrap } from './helpers';

describe('Heading', () => {

    test('should render heading element without passing properties', async () => {
        const app = CustomElement.define({ name: 'app', template: '<au-heading>My heading</au-heading>' });

        const { host, tearDown } = await createFixture('<au-heading>My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h1');
        expect(componentHtml).not.toContain('<h2');

        await tearDown();
    });

    test('should render h2 element', async () => {
        const { host, tearDown } = await createFixture('<au-heading level="2">My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h2');
        expect(componentHtml).not.toContain('<h1');

        await tearDown();
    });

    test('should render h3 element', async () => {
        const { host, tearDown } = await createFixture('<au-heading level="3">My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h3');
        expect(componentHtml).not.toContain('<h1');

        await tearDown();
    });

    test('should render h4 element', async () => {
        const { host, tearDown } = await createFixture('<au-heading level="4">My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h4');
        expect(componentHtml).not.toContain('<h1');

        await tearDown();
    });

    test('should render h5 element', async () => {
        const { host, tearDown } = await createFixture('<au-heading level="5">My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h5');
        expect(componentHtml).not.toContain('<h1');

        await tearDown();
    });

    test('should render h6 element', async () => {
        const { host, tearDown } = await createFixture('<au-heading level="6">My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h6');
        expect(componentHtml).not.toContain('<h1');

        await tearDown();
    });

    test('invalid level value has been provided, so the heading defaults to a h1', async () => {
        const { host, tearDown } = await createFixture('<au-heading level="12">My heading</au-heading>', {}, [AuHeadingCustomElement]);

        const componentHtml = host.querySelector('au-heading')?.shadowRoot?.innerHTML;

        expect(componentHtml).toContain('<h1');

        await tearDown();
    });

    test('truncate adds truncate class', async () => {
        const ViewModel = class Viewmodel {
            truncate = true;
        };

        const { host, tearDown } = await createFixture('<au-heading truncate.bind="truncate">My heading</au-heading>', ViewModel, [AuHeadingCustomElement]);

        const component = host.querySelector('au-heading')?.shadowRoot;

        expect(component?.querySelectorAll('.truncate')).toHaveLength(1);

        await tearDown();
    });

});