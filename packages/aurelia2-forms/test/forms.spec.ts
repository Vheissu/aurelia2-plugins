import { createFixture } from '@aurelia/testing';
import { ExpressionParser } from '@aurelia/expression-parser';
import { ValidationConfiguration, IValidationRules } from '@aurelia/validation';
import { AureliaFormsConfiguration, FormController, required } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-forms', () => {
  test('validates required fields on submit', async () => {
    const submit = jest.fn();

    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-form submit.bind="submit" form.bind="form">\n' +
      '  <input name="email" au-field="value.bind: email; validators.bind: [required()]">\n' +
      '</au-form>',
      class App {
        email = '';
        form: FormController | null = null;
        submit = submit;
        required = required;
      },
      [AureliaFormsConfiguration]
    );

    await startPromise;

    const form = appHost.querySelector('form');
    expect(form).not.toBeNull();

    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flush();

    expect(component.form?.valid).toBe(false);
    expect(submit).not.toHaveBeenCalled();

    component.email = 'test@example.com';

    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flush();

    expect(submit).toHaveBeenCalledTimes(1);

    await tearDown();
  });

  test('validateOn change validates on input', async () => {
    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-form form.bind="form">\n' +
      '  <input name="email" au-field="value.bind: email; validators.bind: [required()]; validate-on.bind: \'change\'">\n' +
      '</au-form>',
      class App {
        email = '';
        form: FormController | null = null;
        required = required;
      },
      [AureliaFormsConfiguration]
    );

    await startPromise;

    const input = appHost.querySelector('input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await flush();

    const field = component.form?.getField('email');
    expect(field?.valid).toBe(false);
    expect(field?.errors.length).toBeGreaterThan(0);

    input.value = 'ok';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await flush();

    expect(field?.valid).toBe(true);

    await tearDown();
  });

  test('validateOn blur sets touched and validates', async () => {
    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-form form.bind="form">\n' +
      '  <input name="email" au-field="value.bind: email; validators.bind: [required()]; validate-on.bind: \'blur\'">\n' +
      '</au-form>',
      class App {
        email = '';
        form: FormController | null = null;
        required = required;
      },
      [AureliaFormsConfiguration]
    );

    await startPromise;

    const input = appHost.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    await flush();

    const field = component.form?.getField('email');
    expect(field?.touched).toBe(true);
    expect(field?.valid).toBe(false);

    await tearDown();
  });

  test('uses aurelia validation rules when validation-model is provided', async () => {
    const submit = jest.fn();

    const { component, appHost, container, startPromise, tearDown } = createFixture(
      '<au-form submit.bind="submit" form.bind="form" validation-model.bind="person">\n' +
      '  <input name="name" au-field="value.bind: person.name">\n' +
      '</au-form>',
      class App {
        person = { name: '' };
        form: FormController | null = null;
        submit = submit;
      },
      [AureliaFormsConfiguration, ExpressionParser, ValidationConfiguration]
    );

    await startPromise;

    const validationRules = container.get(IValidationRules);
    validationRules.on(component.person).ensure('name').required();

    const form = appHost.querySelector('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flush();

    expect(component.form?.valid).toBe(false);
    expect(component.form?.getField('name')?.errors.length).toBeGreaterThan(0);
    expect(submit).not.toHaveBeenCalled();

    component.person.name = 'Dwayne';
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flush();

    expect(component.form?.valid).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);

    validationRules.off();

    await tearDown();
  });
});
