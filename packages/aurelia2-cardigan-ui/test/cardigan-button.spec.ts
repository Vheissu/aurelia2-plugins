import { createFixture } from '@aurelia/testing';
import { CardiganButtonCustomElement } from './../src/components/cardigan-button';

describe('Button', () => {

    test('should render button', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<cardigan-button>Click me</cardigan-button>', class App {}, [CardiganButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');

        expect(button).toBeDefined();

        await tearDown();
    });

    test('should render submit button', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<cardigan-button type="submit">Click me</cardigan-button>', class App {
            type = 'submit';
        }, [CardiganButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');

        expect(button?.getAttribute('type')).toEqual('submit');

        await tearDown();
    });

    test('should set button title', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<cardigan-button title="Test Button">Click me</cardigan-button>', {}, [CardiganButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');

        expect(button?.getAttribute('title')).toEqual('Test Button');

        await tearDown();
    });

    test('should set button colour', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<cardigan-button color="red">Click me</cardigan-button>', {}, [CardiganButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');

        expect(button?.classList.contains('red')).toBeTruthy();

        await tearDown();
    });

    test('should set button size', async () => {
        const { appHost, startPromise, tearDown } = await createFixture('<cardigan-button size="medium">Click me</cardigan-button>', {}, [CardiganButtonCustomElement]);

        await startPromise;

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');

        expect(button?.classList.contains('medium')).toBeTruthy();

        await tearDown();
    });

    test('button clicked triggers callback', async () => {
        const { appHost, component, startPromise, tearDown } = await createFixture('<cardigan-button callback.call="myButtonEvent()">Click me</cardigan-button>', class App {
            myButtonEvent = jest.fn();
        }, [CardiganButtonCustomElement]);

        await startPromise;

        jest.spyOn(component, 'myButtonEvent');

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');
        button?.dispatchEvent(new Event('click'));

        expect(component.myButtonEvent).toBeCalled();

        await tearDown();
    });

    test('button clicked without providing callback', async () => {
        const { appHost, component, startPromise, tearDown } = await createFixture('<cardigan-button>Click me</cardigan-button>', class App {
            myButtonEvent = jest.fn();
        }, [CardiganButtonCustomElement]);

        await startPromise;

        jest.spyOn(component, 'myButtonEvent');

        const button = appHost.querySelector('cardigan-button')?.shadowRoot?.querySelector('button');
        button?.dispatchEvent(new Event('click'));

        expect(component.myButtonEvent).not.toBeCalled();

        await tearDown();
    });

});