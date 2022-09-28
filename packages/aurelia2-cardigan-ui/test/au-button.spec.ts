import { createFixture } from '@aurelia/testing';
import { CustomElement } from '@aurelia/runtime-html';
import { AuButtonCustomElement } from './../src/components/au-button';
import { bootstrap } from './helpers';

describe('Button', () => {

    test('should render button', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<au-button>Click me</au-button>', class App {}, [AuButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');

        expect(button).toBeDefined();

        await tearDown();
    });

    test('should render submit button', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<au-button type="submit">Click me</au-button>', class App {
            type = 'submit';
        }, [AuButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');

        expect(button?.getAttribute('type')).toEqual('submit');

        await tearDown();
    });

    test('should set button title', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<au-button title="Test Button">Click me</au-button>', {}, [AuButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');

        expect(button?.getAttribute('title')).toEqual('Test Button');

        await tearDown();
    });

    test('should set button colour', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<au-button color="red">Click me</au-button>', {}, [AuButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');

        expect(button?.classList.contains('red')).toBeTruthy();

        await tearDown();
    });

    test('should set button size', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<au-button size="medium">Click me</au-button>', {}, [AuButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');

        expect(button?.classList.contains('medium')).toBeTruthy();

        await tearDown();
    });

    test('button clicked triggers callback', async () => {
        const { appHost, component, startPromise, tearDown } = await createFixture('<au-button callback.call="myButtonEvent()">Click me</au-button>', class App {
            myButtonEvent = jest.fn();
        }, [AuButtonCustomElement]);

        await startPromise;

        jest.spyOn(component, 'myButtonEvent');

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');
        button?.dispatchEvent(new Event('click'));

        expect(component.myButtonEvent).toBeCalled();

        await tearDown();
    });

    test('button clicked without providing callback', async () => {
        const { appHost, component, startPromise, tearDown } = await createFixture('<au-button>Click me</au-button>', class App {
            myButtonEvent = jest.fn();
        }, [AuButtonCustomElement]);

        await startPromise;

        jest.spyOn(component, 'myButtonEvent');

        const button = appHost.querySelector('au-button')?.shadowRoot?.querySelector('button');
        button?.dispatchEvent(new Event('click'));

        expect(component.myButtonEvent).not.toBeCalled();

        await tearDown();
    });

});