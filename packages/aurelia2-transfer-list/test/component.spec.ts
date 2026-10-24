import { createFixture } from '@aurelia/testing';
import { CustomElement, runTasks } from 'aurelia';
import { AureliaTransferListConfiguration, AuTransferList } from '../src/index';

async function setup(value: (string | number)[] = []) {
  const f = createFixture(
    '<au-transfer-list options.bind="options" value.two-way="value" filterable orderable max.bind="max" disabled.bind="disabled"></au-transfer-list>',
    {
      options: [
        { id: 'a', label: 'Alpha', disabled: false },
        { id: 'b', label: 'Beta', disabled: false },
        { id: 'c', label: 'Charlie', disabled: true },
        { id: 'd', label: 'Delta', disabled: false },
      ],
      value,
      max: null as number | null,
      disabled: false,
    },
    [AureliaTransferListConfiguration],
  );
  await f.startPromise;
  const host = f.appHost.querySelector('au-transfer-list')!;
  const vm = CustomElement.for<AuTransferList>(host).viewModel;
  const key = (side: 'source' | 'target', key: string, init: KeyboardEventInit = {}) => {
    host
      .querySelector(`[data-side="${side}"] [role="listbox"]`)!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      );
    runTasks();
  };
  return { f, host, vm, key };
}

describe('transfer-list', () => {
  it('publishes immutable additions in option order and preserves disabled options', async () => {
    const { f, vm } = await setup();
    try {
      const old = f.component.value;
      expect(vm.add(['b', 'a', 'c'])).toBe(true);
      runTasks();
      expect(f.component.value).toEqual(['a', 'b']);
      expect(old).toEqual([]);
      expect(vm.source.rows.map((r) => r.key)).toEqual(['c', 'd']);
    } finally {
      await f.tearDown();
    }
  });
  it('keeps unknown assigned keys visible and removable by Enter', async () => {
    const { f, vm, key, host } = await setup(['missing']);
    try {
      expect(vm.target.rows[0].unavailable).toBe(true);
      (host.querySelector('[data-side="target"] [role="listbox"]') as HTMLElement).focus();
      key('target', 'Enter');
      expect(f.component.value).toEqual([]);
    } finally {
      await f.tearDown();
    }
  });
  it('uses active-descendant keyboard navigation, range selection and Enter transfer', async () => {
    const { f, vm, key, host } = await setup();
    try {
      const box = host.querySelector('[data-side="source"] [role="listbox"]') as HTMLElement;
      box.focus();
      runTasks();
      key('source', ' ');
      key('source', 'ArrowDown', { shiftKey: true });
      expect([...vm.source.selected]).toEqual(['a', 'b']);
      expect(box.getAttribute('aria-activedescendant')).toBe(vm.source.rows[1].id);
      key('source', 'Enter');
      expect(f.component.value).toEqual(['a', 'b']);
      expect(document.activeElement).toBe(box);
    } finally {
      await f.tearDown();
    }
  });
  it('filters both lists and clears hidden selection', async () => {
    const { f, vm } = await setup();
    try {
      vm.select('source', ['a', 'b']);
      vm.setFilter('source', 'Beta');
      expect([...vm.source.selected]).toEqual(['b']);
      expect(vm.act('addAll')).toBe(true);
      runTasks();
      expect(f.component.value).toEqual(['b']);
      expect(vm.announcement).not.toBe('');
    } finally {
      await f.tearDown();
    }
  });
  it('enforces maximums without partial transfers', async () => {
    const { f, vm } = await setup(['a']);
    try {
      f.component.max = 2;
      runTasks();
      expect(vm.add(['b', 'd'])).toBe(false);
      expect(f.component.value).toEqual(['a']);
      expect(vm.add(['b'])).toBe(true);
    } finally {
      await f.tearDown();
    }
  });
  it('vetoes changes and protects proposals from event payload mutation', async () => {
    const { f, vm, host } = await setup();
    try {
      host.addEventListener('transfer-before-change', (e) => e.preventDefault(), { once: true });
      expect(vm.add(['a'])).toBe(false);
      host.addEventListener(
        'transfer-before-change',
        (e) => (e as CustomEvent).detail.value.push('wrong'),
        { once: true },
      );
      expect(vm.add(['a'])).toBe(true);
      runTasks();
      expect(f.component.value).toEqual(['a']);
    } finally {
      await f.tearDown();
    }
  });
  it('rejects reentrant changes and changes made stale by a listener', async () => {
    const { f, vm, host } = await setup();
    try {
      host.addEventListener(
        'transfer-before-change',
        () => {
          expect(vm.add(['d'])).toBe(false);
          f.component.options[0].disabled = true;
        },
        { once: true },
      );
      expect(vm.add(['a'])).toBe(false);
      runTasks();
      expect(f.component.value).toEqual([]);
    } finally {
      await f.tearDown();
    }
  });
  it('rechecks disabled state after the before event', async () => {
    const { f, vm, host } = await setup();
    try {
      host.addEventListener(
        'transfer-before-change',
        () => {
          vm.disabled = true;
        },
        { once: true },
      );
      expect(vm.add(['a'])).toBe(false);
    } finally {
      await f.tearDown();
    }
  });
  it('observes in-place option and assigned-key changes', async () => {
    const { f, vm } = await setup();
    try {
      f.component.options[0].label = 'Renamed';
      f.component.value.push('b');
      runTasks();
      expect(vm.source.rows[0].label).toBe('Renamed');
      expect(vm.target.rows[0].key).toBe('b');
    } finally {
      await f.tearDown();
    }
  });
  it('reorders selected target rows and prevents reordering filtered results', async () => {
    const { f, vm, key } = await setup(['a', 'b', 'd']);
    try {
      vm.select('target', ['b']);
      key('target', 'ArrowUp', { altKey: true });
      expect(f.component.value).toEqual(['b', 'a', 'd']);
      vm.setFilter('target', 'Beta');
      expect(vm.reorder(['b'], 1)).toBe(false);
    } finally {
      await f.tearDown();
    }
  });
  it('does not remove disabled assignments and stops actions after unbinding', async () => {
    const { f, vm } = await setup(['c']);
    expect(vm.remove(['c'])).toBe(false);
    await f.tearDown();
    expect(vm.add(['a'])).toBe(false);
  });
  it('uses typeahead and select-all without selecting disabled rows', async () => {
    const { f, vm, key } = await setup();
    try {
      key('source', 'd');
      expect(vm.source.active).toBe('d');
      key('source', 'a', { ctrlKey: true });
      expect([...vm.source.selected]).toEqual(['a', 'b', 'd']);
    } finally {
      await f.tearDown();
    }
  });
});

it('renders projected row content and resumes observation after stop/start', async () => {
  const f = createFixture(
    '<au-transfer-list options.bind="options" value.bind="value"><template au-slot="item"><b>${$host.label}</b><span>${$host.side}</span></template></au-transfer-list>',
    {
      options: [{ id: 'a', label: 'Alpha' }],
      value: [] as string[],
    },
    [AureliaTransferListConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.appHost.querySelector('b')?.textContent).toBe('Alpha');
    expect(f.appHost.querySelector('[role="option"] span')?.textContent).toBe('source');
    await f.au.stop();
    f.component.options[0].label = 'New name';
    await f.au.start();
    expect(f.appHost.querySelector('b')?.textContent).toBe('New name');
    f.component.value.push('a');
    runTasks();
    expect(f.appHost.querySelector('[data-side="target"] [role="option"] b')?.textContent).toBe(
      'New name',
    );
  } finally {
    await f.tearDown();
  }
});
