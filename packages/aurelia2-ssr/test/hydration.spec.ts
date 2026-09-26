import { CustomElement, customElement } from 'aurelia';
import { tasksSettled } from '@aurelia/runtime';
import { RouterConfiguration, route } from '@aurelia/router';
import type { ISSRScope, ISSRTemplateController } from '@aurelia/runtime-html';
import {
  buildSsrDocument,
  createRouterSettle,
  createSsrRouterRegistrations,
  hydrateAureliaSsr,
  readSsrManifest,
  recordSsrManifest,
  renderAureliaToString,
  verifySsrHydration,
} from '../src';
import type { SsrRouteConfig, SsrSiteConfig } from '../src';

const site: SsrSiteConfig = {
  origin: 'https://example.com',
  siteName: 'Example',
  rendering: {
    hostTagName: 'ssr-hydrate-app',
    takeoverMode: 'hydrate',
  },
};

const route$: SsrRouteConfig = {
  path: '/',
  seo: {
    title: 'Hydration',
    description: 'A page that hydrates instead of remounting on the client.',
  },
  render: { takeoverMode: 'hydrate' },
};

const Child = CustomElement.define({
  name: 'ssr-child',
  template: '<em>${label}</em>',
  bindables: ['label'],
}, class {
  public label = '';
});

class HydrateAppModel {
  public title = 'Hello';
  public show = true;
  public items = ['a', 'b', 'c'];
  public details = { count: 3 };
}

const HydrateApp = CustomElement.define({
  name: 'ssr-hydrate-app',
  template: [
    '<h1>${title}</h1>',
    '<p if.bind="show">Shown</p>',
    '<p else>Hidden</p>',
    '<ul><li repeat.for="item of items">${item}</li></ul>',
    '<ssr-child label.bind="title"></ssr-child>',
    '<section with.bind="details"><b>${count}</b></section>',
  ].join(''),
  dependencies: [Child],
}, HydrateAppModel);

function childLabel(child: ISSRScope['children'][number]): string {
  return 'type' in child ? child.type : child.name ?? '(view)';
}

async function renderHydrateApp() {
  document.body.innerHTML = '<ssr-hydrate-app></ssr-hydrate-app>';

  return renderAureliaToString({
    window,
    component: HydrateApp,
    site,
    route: route$,
    settle: 0,
  });
}

describe('aurelia2-ssr manifest recording', () => {
  test('records the controller tree in the shape Aurelia core hydrates from', async () => {
    const result = await renderHydrateApp();

    expect(result.diagnostics).toEqual([]);
    expect(result.appHtml).toContain('<!--au-start-->');
    expect(result.timings?.manifestMs).toBeDefined();

    const scope = result.ssrScope!;
    expect(scope.name).toBe('ssr-hydrate-app');
    expect(scope.nodeCount).toBeUndefined();
    expect(scope.children.map(childLabel)).toEqual(['if', 'else', 'repeat', 'ssr-child', 'with']);

    const [ifEntry, elseEntry, repeatEntry, childScope, withEntry] = scope.children as [
      ISSRTemplateController,
      ISSRTemplateController,
      ISSRTemplateController,
      ISSRScope,
      ISSRTemplateController,
    ];

    expect(ifEntry).toEqual({ type: 'if', state: { value: true }, views: [{ nodeCount: 1, children: [] }] });
    expect(elseEntry).toEqual({ type: 'else', views: [] });
    expect(repeatEntry.views).toEqual([
      { nodeCount: 1, children: [] },
      { nodeCount: 1, children: [] },
      { nodeCount: 1, children: [] },
    ]);
    expect(childScope).toEqual({ name: 'ssr-child', children: [] });
    expect(withEntry.views).toEqual([{ nodeCount: 1, children: [] }]);
  });

  test('records the else branch when the if condition is false', async () => {
    document.body.innerHTML = '<ssr-hydrate-app></ssr-hydrate-app>';

    const result = await renderAureliaToString({
      window,
      component: HydrateApp,
      site,
      route: route$,
      settle: 0,
      afterStart: async context => {
        const controller = CustomElement.for<HydrateAppModel>(context.host);
        controller.viewModel.show = false;
        await tasksSettled();
      },
    });

    const ifEntry = result.ssrScope!.children[0] as ISSRTemplateController;
    expect(ifEntry.state).toEqual({ value: false });
    expect(ifEntry.views).toHaveLength(1);
    expect(result.appHtml).toContain('Hidden');
    expect(result.appHtml).not.toContain('Shown');
  });

  test('flags text nodes that would not survive an HTML round trip', async () => {
    const Fragile = CustomElement.define({
      name: 'ssr-fragile-app',
      template: '<div><template repeat.for="item of items">${item}</template></div>',
    }, class {
      public items = ['', 'x'];
    });
    document.body.innerHTML = '<ssr-fragile-app></ssr-fragile-app>';

    const result = await renderAureliaToString({
      window,
      component: Fragile,
      hostSelector: 'ssr-fragile-app',
      route: route$,
      settle: 0,
    });

    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'manifest_empty_text_node', severity: 'error' }),
    ]));
  });

  test('reports hydrate mode without markers as an error', async () => {
    document.body.innerHTML = '<ssr-hydrate-app></ssr-hydrate-app>';

    const result = await renderAureliaToString({
      window,
      component: HydrateApp,
      site,
      route: route$,
      settle: 0,
      serialize: { stripAureliaMarkers: true },
    });

    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toContain('hydrate_requires_markers');
  });
});

describe('aurelia2-ssr hydration round trip', () => {
  test('adopts the server DOM and keeps bindings live', async () => {
    const rendered = await renderHydrateApp();

    document.body.innerHTML = rendered.appHtml;
    const host = document.querySelector<HTMLElement>('ssr-hydrate-app')!;
    const before = host.innerHTML;
    const heading = host.querySelector('h1')!;
    const items = Array.from(host.querySelectorAll('li'));
    const emphasis = host.querySelector('em')!;

    const hydrated = await hydrateAureliaSsr({
      component: HydrateApp,
      host,
      ssrScope: rendered.ssrScope,
    });

    try {
      expect(host.innerHTML).toBe(before);
      expect(host.querySelector('h1')).toBe(heading);
      expect(Array.from(host.querySelectorAll('li'))).toEqual(items);
      expect(document.documentElement.hasAttribute('data-aurelia-taken-over')).toBe(true);

      const viewModel = hydrated.root.controller.viewModel as HydrateAppModel;
      viewModel.title = 'Updated';
      await tasksSettled();
      expect(heading.textContent).toBe('Updated');
      expect(emphasis.textContent).toBe('Updated');

      viewModel.items.push('d');
      await tasksSettled();
      expect(host.querySelectorAll('li')).toHaveLength(4);
      expect(host.querySelectorAll('li')[3].textContent).toBe('d');

      viewModel.show = false;
      await tasksSettled();
      expect(host.textContent).toContain('Hidden');
      expect(host.textContent).not.toContain('Shown');
    } finally {
      await hydrated.stop();
    }
  });

  test('reads the manifest embedded by buildSsrDocument', async () => {
    const rendered = await renderHydrateApp();
    const documentResult = buildSsrDocument({
      template: '<html><head></head><body><ssr-hydrate-app></ssr-hydrate-app></body></html>',
      route: route$,
      site,
      render: rendered,
    });

    expect(documentResult.document.querySelector('#aurelia-ssr-manifest')).toBeTruthy();
    expect(documentResult.document.querySelector('#aurelia-ssr-context')?.textContent).toContain('"takeoverMode":"hydrate"');

    document.body.innerHTML = documentResult.document.body.innerHTML;
    expect(readSsrManifest()).toEqual(rendered.ssrScope);

    const remount = buildSsrDocument({
      template: '<html><head></head><body><ssr-hydrate-app></ssr-hydrate-app></body></html>',
      route: { ...route$, render: { takeoverMode: 'remount' } },
      site: { ...site, rendering: { hostTagName: 'ssr-hydrate-app' } },
      render: rendered,
    });
    expect(remount.document.querySelector('#aurelia-ssr-manifest')).toBeNull();
  });

  test('refuses to hydrate without a manifest', async () => {
    document.body.innerHTML = '<ssr-hydrate-app><h1>Server</h1></ssr-hydrate-app>';

    await expect(hydrateAureliaSsr({ component: HydrateApp, hostSelector: 'ssr-hydrate-app' }))
      .rejects.toThrow(/no manifest/u);
  });
});

describe('aurelia2-ssr hydration verification', () => {
  test('passes for output that hydrates cleanly', async () => {
    const rendered = await renderHydrateApp();

    const verification = await verifySsrHydration({
      window,
      component: HydrateApp,
      appHtml: rendered.appHtml,
      ssrScope: rendered.ssrScope!,
    });

    expect(verification.diagnostics).toEqual([]);
    expect(verification.ok).toBe(true);
    expect(verification.nodesAfter).toBe(verification.nodesBefore);
    expect(document.querySelector('[data-aurelia-ssr-verify]')).toBeNull();
  });

  test('fails when the manifest does not match the markup', async () => {
    const rendered = await renderHydrateApp();
    const broken: ISSRScope = JSON.parse(JSON.stringify(rendered.ssrScope));
    (broken.children[2] as ISSRTemplateController).views.splice(1);

    const verification = await verifySsrHydration({
      window,
      component: HydrateApp,
      appHtml: rendered.appHtml,
      ssrScope: broken,
    });

    expect(verification.ok).toBe(false);
    expect(verification.diagnostics.some(diagnostic => diagnostic.severity === 'error')).toBe(true);
    expect(document.querySelector('[data-aurelia-ssr-verify]')).toBeNull();
  });

  test('can run as part of renderAureliaToString', async () => {
    document.body.innerHTML = '<ssr-hydrate-app></ssr-hydrate-app>';

    const result = await renderAureliaToString({
      window,
      component: HydrateApp,
      site,
      route: route$,
      settle: 0,
      verifyHydration: true,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.timings?.verifyMs).toBeDefined();
    expect(document.querySelector('[data-aurelia-ssr-verify]')).toBeNull();
  });
});

describe('aurelia2-ssr router manifests', () => {
  @customElement({ name: 'ssr-home-page', template: '<h2>Home</h2>' })
  class HomePage {}

  @customElement({ name: 'ssr-about-page', template: '<h2>About ${team}</h2><p repeat.for="member of members">${member}</p>' })
  class AboutPage {
    public team = 'Aurelia';
    public members = ['one', 'two'];
  }

  @route({
    routes: [
      { path: '', component: HomePage },
      { path: 'about', component: AboutPage },
    ],
  })
  @customElement({ name: 'ssr-router-app', template: '<nav>Nav</nav><au-viewport></au-viewport>' })
  class RouterApp {}

  test('records routed components under their viewport and waits for the router to settle', async () => {
    document.body.innerHTML = '<ssr-router-app></ssr-router-app>';

    const result = await renderAureliaToString({
      window,
      component: RouterApp,
      hostSelector: 'ssr-router-app',
      route: { ...route$, path: '/about' },
      registrations: [
        RouterConfiguration.customize({ useUrlFragmentHash: false }),
        ...await createSsrRouterRegistrations({ path: '/about' }),
      ],
      settle: createRouterSettle(),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.appHtml).toContain('<ssr-about-page><h2>About <!--au-->Aurelia</h2>');

    const scope = result.ssrScope!;
    expect(scope.children.map(childLabel)).toEqual(['au-viewport']);

    const viewport = scope.children[0] as ISSRScope;
    expect(viewport.children.map(childLabel)).toEqual(['ssr-about-page']);

    const page = viewport.children[0] as ISSRScope;
    expect(page.children.map(childLabel)).toEqual(['repeat']);
    expect((page.children[0] as ISSRTemplateController).views).toHaveLength(2);
  });

  test('recordSsrManifest can be called directly against a running app root', async () => {
    document.body.innerHTML = '<ssr-hydrate-app></ssr-hydrate-app>';

    let recorded: ReturnType<typeof recordSsrManifest> | undefined;
    await renderAureliaToString({
      window,
      component: HydrateApp,
      site,
      route: route$,
      settle: 0,
      afterStart: context => {
        recorded = recordSsrManifest(CustomElement.for(context.host), { path: '/' });
      },
    });

    expect(recorded?.diagnostics).toEqual([]);
    expect(recorded?.manifest.root).toBe('ssr-hydrate-app');
    expect(recorded?.stats).toEqual({ elements: 2, templateControllers: 4, views: 5, dynamicChildren: 0 });
  });
});
