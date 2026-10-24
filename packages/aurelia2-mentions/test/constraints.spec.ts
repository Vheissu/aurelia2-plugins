import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaMentionsConfiguration } from '../src/index';
async function setup() {
  const f = createFixture(
    '<textarea maxlength="8" value.bind="text" mentions="triggers.bind: triggers; state.from-view: state"></textarea>',
    {
      text: '',
      triggers: [{ char: '@', search: () => [{ id: 'ana', label: 'Ana Smith' }] }],
      state: undefined as any,
    },
    [AureliaMentionsConfiguration],
  );
  await f.startPromise;
  const field = f.appHost.querySelector('textarea')!;
  field.focus();
  field.value = '@a';
  field.setSelectionRange(2, 2);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  runTasks();
  return { f, field };
}
it('does not bypass a native maximum length when inserting a mention', async () => {
  const { f, field } = await setup();
  try {
    expect(f.component.state.select(0)).toBe(false);
    expect(field.value).toBe('@a');
  } finally {
    await f.tearDown();
  }
});
it('rechecks readOnly after a before-insert listener', async () => {
  const { f, field } = await setup();
  field.maxLength = 100;
  field.addEventListener('mention-before-insert', () => {
    field.readOnly = true;
  });
  try {
    expect(f.component.state.select(0)).toBe(false);
    expect(field.value).toBe('@a');
  } finally {
    await f.tearDown();
  }
});
it('refuses selection when the host becomes disabled while suggestions are open', async () => {
  const { f, field } = await setup();
  field.maxLength = 100;
  field.disabled = true;
  try {
    expect(f.component.state.select(0)).toBe(false);
    expect(field.value).toBe('@a');
  } finally {
    await f.tearDown();
  }
});
