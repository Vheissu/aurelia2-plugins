import { createFixture } from '@aurelia/testing';
import { AureliaCommandPaletteConfiguration, ICommandPaletteService } from './../src/index';
import type { CommandPaletteCommand } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-command-palette', () => {
  test('service registers, searches, and executes commands', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaCommandPaletteConfiguration]
    );

    await startPromise;

    const service = container.get(ICommandPaletteService);
    const action = jest.fn();
    const handle = service.register([
      { id: 'project.new', title: 'Create project', keywords: ['workspace'], action },
      { id: 'billing.open', title: 'Open billing', section: 'Settings' },
      { id: 'hidden', title: 'Hidden command', hidden: true },
    ]);

    expect(service.search('proj').map((command) => command.id)).toEqual(['project.new']);
    expect(service.search('settings').map((command) => command.id)).toEqual(['billing.open']);
    expect(service.search('').map((command) => command.id)).not.toContain('hidden');

    await service.execute(service.search('workspace')[0]);
    expect(action).toHaveBeenCalledTimes(1);

    handle.dispose();
    expect(service.search('project')).toEqual([]);

    await tearDown();
  });

  test('component filters commands and emits selection events', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-command-palette
        open.two-way="open"
        query.two-way="query"
        commands.bind="commands"
        command-palette-select.trigger="selected = $event.detail">
      </au-command-palette>`,
      class App {
        public open = true;
        public query = '';
        public selected: CommandPaletteCommand | null = null;
        public create = jest.fn();
        public commands: CommandPaletteCommand[] = [
          { id: 'new', title: 'Create project', subtitle: 'Start fresh', action: this.create },
          { id: 'invite', title: 'Invite teammate', keywords: ['people'] },
        ];
      },
      [AureliaCommandPaletteConfiguration]
    );

    await startPromise;
    await flush();

    const input = appHost.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();

    component.query = 'invite';
    await flush();

    const buttons = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-cp-item'));
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Invite teammate');

    buttons[0].click();
    await flush();

    expect(component.selected?.id).toBe('invite');
    expect(component.open).toBe(false);

    await tearDown();
  });

  test('component supports keyboard navigation and enter selection', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-command-palette open.bind="true" commands.bind="commands" command-palette-select.trigger="selected = $event.detail"></au-command-palette>`,
      class App {
        public selected: CommandPaletteCommand | null = null;
        public commands: CommandPaletteCommand[] = [
          { id: 'first', title: 'First' },
          { id: 'second', title: 'Second' },
        ];
      },
      [AureliaCommandPaletteConfiguration]
    );

    await startPromise;
    await flush();

    const input = appHost.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();

    expect(component.selected?.id).toBe('second');

    await tearDown();
  });
});
