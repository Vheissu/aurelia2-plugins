import { CustomElement } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { AubsAccordionCustomElement } from '../src/accordion/aubs-accordion';
import { AubsAccordionGroupCustomElement } from '../src/accordion/aubs-accordion-group';
import { AubsAlertCustomAttribute } from '../src/alert/aubs-alert';
import { AubsButtonToggleCustomAttribute } from '../src/button/aubs-button-toggle';
import { AubsCarouselCustomAttribute } from '../src/carousel/aubs-carousel';
import { AubsCollapseCustomAttribute } from '../src/collapse/aubs-collapse';
import { AubsDropdownCustomAttribute } from '../src/dropdown/aubs-dropdown';
import { AubsDropdownToggleCustomAttribute } from '../src/dropdown/aubs-dropdown-toggle';
import { AubsModalCustomAttribute } from '../src/modal/aubs-modal';
import { AubsOffcanvasCustomAttribute } from '../src/offcanvas/aubs-offcanvas';
import { AubsPopoverCustomAttribute } from '../src/popover/aubs-popover';
import { AubsScrollspyCustomAttribute } from '../src/scrollspy/aubs-scrollspy';
import { AubsTabCustomElement } from '../src/tabs/aubs-tab';
import { AubsTabToggleCustomAttribute } from '../src/tabs/aubs-tab-toggle';
import { AubsTabsetCustomElement } from '../src/tabs/aubs-tabset';
import { AubsToastCustomAttribute } from '../src/toast/aubs-toast';
import { AubsTooltipCustomAttribute } from '../src/tooltip/aubs-tooltip';
import { Alert, Button, Carousel, Collapse, Dropdown, Modal, Offcanvas, ScrollSpy, Tab, Toast } from 'bootstrap';

jest.mock('velocity-animate', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
}));

jest.mock('@popperjs/core', () => ({
  createPopper: jest.fn(() => ({
    update: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(),
  })),
}));

const modalInstances: Array<{ show: jest.Mock; hide: jest.Mock; dispose: jest.Mock }> = [];
const offcanvasInstances: Array<{ show: jest.Mock; hide: jest.Mock; dispose: jest.Mock }> = [];
const toastInstances: Array<{ show: jest.Mock; hide: jest.Mock; dispose: jest.Mock }> = [];
const carouselInstances: Array<{ to: jest.Mock; dispose: jest.Mock }> = [];
const scrollSpyInstances: Array<{ refresh: jest.Mock; dispose: jest.Mock }> = [];
const alertInstances: Array<{ close: jest.Mock; dispose: jest.Mock }> = [];
const buttonInstances: Array<{ toggle: jest.Mock; dispose: jest.Mock }> = [];
const tabInstances: Array<{ show: jest.Mock; dispose: jest.Mock }> = [];
const collapseInstances: Array<{ show: jest.Mock; hide: jest.Mock; dispose: jest.Mock }> = [];
const dropdownInstances: Array<{ show: jest.Mock; hide: jest.Mock; toggle: jest.Mock; dispose: jest.Mock }> = [];

jest.mock('bootstrap', () => {
  const createInstance = (overrides: Record<string, jest.Mock> = {}) => ({
    show: jest.fn(),
    hide: jest.fn(),
    to: jest.fn(),
    refresh: jest.fn(),
    dispose: jest.fn(),
    ...overrides,
  });

  return {
    Alert: jest.fn().mockImplementation(() => {
      const instance = { close: jest.fn(), dispose: jest.fn() };
      alertInstances.push(instance);
      return instance;
    }),
    Button: jest.fn().mockImplementation((element: HTMLElement) => {
      const instance = {
        toggle: jest.fn(() => element.classList.toggle('active')),
        dispose: jest.fn(),
      };
      buttonInstances.push(instance);
      return instance;
    }),
    Collapse: jest.fn().mockImplementation(() => {
      const instance = { show: jest.fn(), hide: jest.fn(), dispose: jest.fn() };
      collapseInstances.push(instance);
      return instance;
    }),
    Dropdown: jest.fn().mockImplementation(() => {
      const instance = { show: jest.fn(), hide: jest.fn(), toggle: jest.fn(), dispose: jest.fn() };
      dropdownInstances.push(instance);
      return instance;
    }),
    Modal: jest.fn().mockImplementation(() => {
      const instance = createInstance();
      modalInstances.push(instance);
      return instance;
    }),
    Offcanvas: jest.fn().mockImplementation(() => {
      const instance = createInstance();
      offcanvasInstances.push(instance);
      return instance;
    }),
    Toast: jest.fn().mockImplementation(() => {
      const instance = createInstance();
      toastInstances.push(instance);
      return instance;
    }),
    Carousel: jest.fn().mockImplementation(() => {
      const instance = createInstance();
      carouselInstances.push(instance);
      return instance;
    }),
    ScrollSpy: jest.fn().mockImplementation(() => {
      const instance = createInstance();
      scrollSpyInstances.push(instance);
      return instance;
    }),
    Tab: jest.fn().mockImplementation(() => {
      const instance = { show: jest.fn(), dispose: jest.fn() };
      tabInstances.push(instance);
      return instance;
    }),
  };
});

const bootstrapRegistrations = [
  AubsAccordionCustomElement,
  AubsAccordionGroupCustomElement,
  AubsAlertCustomAttribute,
  AubsButtonToggleCustomAttribute,
  AubsCarouselCustomAttribute,
  AubsCollapseCustomAttribute,
  AubsDropdownCustomAttribute,
  AubsDropdownToggleCustomAttribute,
  AubsModalCustomAttribute,
  AubsOffcanvasCustomAttribute,
  AubsPopoverCustomAttribute,
  AubsScrollspyCustomAttribute,
  AubsTabCustomElement,
  AubsTabToggleCustomAttribute,
  AubsTabsetCustomElement,
  AubsToastCustomAttribute,
  AubsTooltipCustomAttribute,
];

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function getFixtureRoot(appHost: HTMLElement): ParentNode {
  return appHost.shadowRoot ?? appHost;
}

function getShadowOrHost(element: HTMLElement | null, label: string): ParentNode {
  if (!element) {
    throw new Error(`${label} not found in fixture`);
  }
  return element.shadowRoot ?? element;
}

describe('aurelia2-bootstrap (Bootstrap 5)', () => {
  beforeEach(() => {
    modalInstances.length = 0;
    offcanvasInstances.length = 0;
    toastInstances.length = 0;
    carouselInstances.length = 0;
    scrollSpyInstances.length = 0;
    alertInstances.length = 0;
    buttonInstances.length = 0;
    tabInstances.length = 0;
    collapseInstances.length = 0;
    dropdownInstances.length = 0;

    (Alert as jest.Mock).mockClear();
    (Button as jest.Mock).mockClear();
    (Collapse as jest.Mock).mockClear();
    (Dropdown as jest.Mock).mockClear();
    (Modal as jest.Mock).mockClear();
    (Offcanvas as jest.Mock).mockClear();
    (Toast as jest.Mock).mockClear();
    (Carousel as jest.Mock).mockClear();
    (ScrollSpy as jest.Mock).mockClear();
    (Tab as jest.Mock).mockClear();
  });

  test('accordion closes other groups when closeOthers is true', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<aubs-accordion close-others.bind="true">
        <aubs-accordion-group title="One" is-open.bind="openFirst">
          First
        </aubs-accordion-group>
        <aubs-accordion-group title="Two" is-open.bind="openSecond">
          Second
        </aubs-accordion-group>
      </aubs-accordion>`,
      class {
        openFirst = false;
        openSecond = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    const root = getFixtureRoot(appHost);
    const accordionRoot = getShadowOrHost(root.querySelector('aubs-accordion') as HTMLElement, 'aubs-accordion');
    const buttons = accordionRoot.querySelectorAll<HTMLButtonElement>('.accordion-button');
    const collapses = accordionRoot.querySelectorAll<HTMLElement>('.accordion-collapse');

    buttons[0].dispatchEvent(new Event('click', { bubbles: true }));
    await flush();

    expect(component.openFirst).toBe(true);
    expect(component.openSecond).toBe(false);

    buttons[1].dispatchEvent(new Event('click', { bubbles: true }));
    await flush();

    expect(component.openFirst).toBe(false);
    expect(component.openSecond).toBe(true);

    await tearDown();
  });

  test('dropdown toggle delegates to Bootstrap and syncs isOpen', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div class="dropdown" aubs-dropdown="is-open.bind: open">
        <button class="btn dropdown-toggle" aubs-dropdown-toggle>Toggle</button>
        <div class="dropdown-menu">
          <a class="dropdown-item">Item</a>
        </div>
      </div>`,
      class {
        open = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    const root = getFixtureRoot(appHost);
    const toggle = root.querySelector('button') as HTMLButtonElement;

    toggle.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();

    expect(Dropdown).toHaveBeenCalledTimes(1);
    expect(dropdownInstances[0].toggle).toHaveBeenCalled();

    toggle.dispatchEvent(new Event('shown.bs.dropdown'));
    await flush();
    expect(component.open).toBe(true);

    toggle.dispatchEvent(new Event('hidden.bs.dropdown'));
    await flush();
    expect(component.open).toBe(false);

    component.open = true;
    await flush();
    expect(dropdownInstances[0].show).toHaveBeenCalled();

    component.open = false;
    await flush();
    expect(dropdownInstances[0].hide).toHaveBeenCalled();

    await tearDown();
  });

  test('tooltip renders Bootstrap 5 markup', async () => {
    const { startPromise, tearDown } = createFixture(
      `<button aubs-tooltip="text.bind: tooltipText; open.bind: open"></button>`,
      class {
        tooltipText = 'Hello';
        open = true;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    const tooltip = document.body.querySelector('.tooltip') as HTMLElement;
    expect(tooltip).toBeTruthy();
    expect(tooltip.classList.contains('bs-tooltip-top')).toBe(true);
    expect(tooltip.querySelector('.tooltip-arrow')).toBeTruthy();
    expect(tooltip.querySelector('.tooltip-inner')?.textContent).toContain('Hello');

    await tearDown();
  });

  test('popover renders Bootstrap 5 markup', async () => {
    const { startPromise, tearDown } = createFixture(
      `<button aubs-popover="title.bind: title; body.bind: body; is-open.bind: open"></button>`,
      class {
        title = 'Title';
        body = 'Body';
        open = true;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    const popover = document.body.querySelector('.popover') as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.classList.contains('bs-popover-top')).toBe(true);
    expect(popover.querySelector('.popover-arrow')).toBeTruthy();
    expect(popover.querySelector('.popover-header')?.textContent).toContain('Title');
    expect(popover.querySelector('.popover-body')?.textContent).toContain('Body');

    await tearDown();
  });

  test('collapse shows/hides based on collapsed binding', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div class="collapse" aubs-collapse="collapsed.bind: collapsed"></div>`,
      class {
        collapsed = true;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    expect(Collapse).toHaveBeenCalledTimes(1);
    expect(collapseInstances[0].hide).toHaveBeenCalled();

    component.collapsed = false;
    await flush();

    expect(collapseInstances[0].show).toHaveBeenCalled();

    const root = getFixtureRoot(appHost);
    const collapse = root.querySelector('.collapse') as HTMLElement;

    collapse.dispatchEvent(new Event('shown.bs.collapse'));
    await flush();
    expect(component.collapsed).toBe(false);

    collapse.dispatchEvent(new Event('hidden.bs.collapse'));
    await flush();
    expect(component.collapsed).toBe(true);

    await tearDown();
  });

  test('tabs toggle active pane classes', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<aubs-tabset active.bind="active">
        <aubs-tab header="One">One</aubs-tab>
        <aubs-tab header="Two">Two</aubs-tab>
      </aubs-tabset>`,
      class {
        active = 0;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    const root = getFixtureRoot(appHost);
    const tabsetRoot = getShadowOrHost(root.querySelector('aubs-tabset') as HTMLElement, 'aubs-tabset');
    const tabs = Array.from(tabsetRoot.querySelectorAll<HTMLElement>('aubs-tab'));
    const tabViewModels = tabs.map((tab) => CustomElement.for(tab)?.viewModel as { active: boolean });
    expect(tabViewModels[0].active).toBe(true);
    expect(tabViewModels[1].active).toBe(false);

    component.active = 1;
    await flush();

    expect(tabViewModels[0].active).toBe(false);
    expect(tabViewModels[1].active).toBe(true);

    await tearDown();
  });

  test('alert closes when isOpen becomes false', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div class="alert" aubs-alert="is-open.bind: open"></div>`,
      class {
        open = true;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.open = false;
    await flush();

    expect(Alert).toHaveBeenCalledTimes(1);
    expect(alertInstances[0].close).toHaveBeenCalled();

    const root = getFixtureRoot(appHost);
    const alert = root.querySelector('.alert') as HTMLElement;
    alert.dispatchEvent(new Event('closed.bs.alert'));
    await flush();

    expect(component.open).toBe(false);

    await tearDown();
  });

  test('button toggle syncs active state', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<button class="btn" type="button" aubs-button-toggle="active.bind: active"></button>`,
      class {
        active = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.active = true;
    await flush();

    expect(Button).toHaveBeenCalledTimes(1);
    expect(buttonInstances[0].toggle).toHaveBeenCalled();

    const root = getFixtureRoot(appHost);
    const button = root.querySelector('button') as HTMLButtonElement;
    button.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();

    expect(component.active).toBe(false);

    await tearDown();
  });

  test('tab toggle shows on click and syncs active binding', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<button class="nav-link" data-bs-target="#tab-target" aubs-tab-toggle="active.bind: active"></button>`,
      class {
        active = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    const root = getFixtureRoot(appHost);
    const tab = root.querySelector('button') as HTMLButtonElement;

    tab.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();

    expect(Tab).toHaveBeenCalledTimes(1);
    expect(tabInstances[0].show).toHaveBeenCalled();

    tab.dispatchEvent(new Event('shown.bs.tab'));
    await flush();
    expect(component.active).toBe(true);

    tab.dispatchEvent(new Event('hidden.bs.tab'));
    await flush();
    expect(component.active).toBe(false);

    component.active = true;
    await flush();

    expect(tabInstances[0].show).toHaveBeenCalled();

    await tearDown();
  });

  test('modal toggles show/hide based on isOpen', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div class="modal" aubs-modal="is-open.bind: open"></div>`,
      class {
        open = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.open = true;
    await flush();

    expect(Modal).toHaveBeenCalledTimes(1);
    expect(modalInstances[0].show).toHaveBeenCalled();

    component.open = false;
    await flush();

    expect(modalInstances[0].hide).toHaveBeenCalled();

    const root = getFixtureRoot(appHost);
    const modal = root.querySelector('.modal') as HTMLElement;
    modal.dispatchEvent(new Event('shown.bs.modal'));
    await flush();
    expect(component.open).toBe(true);

    await tearDown();
  });

  test('offcanvas toggles show/hide based on isOpen', async () => {
    const { component, startPromise, tearDown } = createFixture(
      `<div class="offcanvas" aubs-offcanvas="is-open.bind: open"></div>`,
      class {
        open = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.open = true;
    await flush();

    expect(Offcanvas).toHaveBeenCalledTimes(1);
    expect(offcanvasInstances[0].show).toHaveBeenCalled();

    component.open = false;
    await flush();

    expect(offcanvasInstances[0].hide).toHaveBeenCalled();

    await tearDown();
  });

  test('toast toggles show/hide based on isOpen', async () => {
    const { component, startPromise, tearDown } = createFixture(
      `<div class="toast" aubs-toast="is-open.bind: open"></div>`,
      class {
        open = false;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.open = true;
    await flush();

    expect(Toast).toHaveBeenCalledTimes(1);
    expect(toastInstances[0].show).toHaveBeenCalled();

    component.open = false;
    await flush();

    expect(toastInstances[0].hide).toHaveBeenCalled();

    await tearDown();
  });

  test('carousel syncs active index', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div class="carousel" aubs-carousel="active.bind: active"></div>`,
      class {
        active = 0;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.active = 2;
    await flush();

    expect(Carousel).toHaveBeenCalledTimes(1);
    expect(carouselInstances[0].to).toHaveBeenCalledWith(2);

    const root = getFixtureRoot(appHost);
    const carousel = root.querySelector('.carousel') as HTMLElement;
    const slidEvent = new Event('slid.bs.carousel') as Event & { to?: number };
    slidEvent.to = 1;
    carousel.dispatchEvent(slidEvent);
    await flush();

    expect(component.active).toBe(1);

    await tearDown();
  });

  test('scrollspy refresh trigger calls refresh', async () => {
    const { component, startPromise, tearDown } = createFixture(
      `<div class="scrollspy-example" aubs-scrollspy="options.bind: options; refresh-trigger.bind: refresh"></div>`,
      class {
        options = { target: document.body };
        refresh = 0;
      },
      bootstrapRegistrations
    );

    await startPromise;
    await flush();

    component.refresh = 1;
    await flush();

    expect(ScrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpyInstances[0].refresh).toHaveBeenCalled();

    await tearDown();
  });
});
