import { Outclick } from './../src/aurelia-outclick';
import { createFixture } from '@aurelia/testing';

describe('Outclick', () => {

    test('outside click fires event', async () => {
        const callbackFn = jest.fn();
        const { appHost, startPromise, tearDown } = await createFixture('<div id="outer"><div id="inner" outclick.bind="callback"></div></div>', class App {
            callback() {
                callbackFn();
            };
        }, [Outclick]);

        await startPromise;

        const clickEvent = new CustomEvent('click', {
            bubbles: true,
            composed: true,
            cancelable: true
        });

        appHost.querySelector('#outer')?.dispatchEvent(clickEvent);

        expect(callbackFn).toHaveBeenCalledTimes(1);

        await tearDown();
    });

    test('outside click fires event using lamba', async () => {
        const callbackFn = jest.fn();
        const { appHost, startPromise, tearDown } = await createFixture('<div id="outer"><div id="inner" outclick.bind="() => callback()"></div></div>', class App {
            callback() {
                callbackFn();
            };
        }, [Outclick]);

        await startPromise;

        const clickEvent = new CustomEvent('click', {
            bubbles: true,
            composed: true,
            cancelable: true
        });

        appHost.querySelector('#outer')?.dispatchEvent(clickEvent);

        expect(callbackFn).toHaveBeenCalledTimes(1);

        await tearDown();
    });

    test('outside click fires event using fn', async () => {
        const callbackFn = jest.fn();
        const { appHost, startPromise, tearDown } = await createFixture('<div id="outer"><div id="inner" outclick="fn.bind: callback"></div></div>', class App {
            callback() {
                callbackFn();
            };
        }, [Outclick]);

        await startPromise;

        const clickEvent = new CustomEvent('click', {
            bubbles: true,
            composed: true,
            cancelable: true
        });

        appHost.querySelector('#outer')?.dispatchEvent(clickEvent);

        expect(callbackFn).toHaveBeenCalledTimes(1);

        await tearDown();
    });

    test('outside click does not fire event using fn lamba', async () => {
        const callbackFn = jest.fn();
        const { appHost, startPromise, tearDown } = await createFixture('<div id="outer"><div id="inner" outclick="fn.bind: () => callback()"></div></div>', class App {
            callback() {
                callbackFn();
            };
        }, [Outclick]);

        await startPromise;

        const clickEvent = new CustomEvent('click', {
            bubbles: true,
            composed: true,
            cancelable: true
        });

        appHost.querySelector('#inner')?.dispatchEvent(clickEvent);

        expect(callbackFn).not.toBeCalled();

        await tearDown();
    });

    test('inside click does not fire event', async () => {
        const callbackFn = jest.fn();
        const { appHost, startPromise, tearDown } = await createFixture('<div id="outer"><div id="inner" outclick.bind="callback"></div></div>', class App {
            callback() {
                callbackFn();
            };
        }, [Outclick]);

        await startPromise;

        const clickEvent = new CustomEvent('click', {
            bubbles: true,
            composed: true,
            cancelable: true
        });

        appHost.querySelector('#inner')?.dispatchEvent(clickEvent);

        expect(callbackFn).not.toBeCalled();

        await tearDown();
    });

});