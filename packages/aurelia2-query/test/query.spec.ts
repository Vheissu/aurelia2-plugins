import { bindable, customElement, CustomElement } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { AureliaQueryConfiguration, QueryResult } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

@customElement({
  name: 'result-host',
  template: '<template></template>',
})
class ResultHost {
  @bindable public result: QueryResult | null = null;
}

describe('aurelia2-query', () => {
  test('query binding creates result and fetches data', async () => {
    const fetch = jest.fn().mockResolvedValue('ok');

    const { component, startPromise, tearDown } = createFixture(
      '<au-query query.bind="query" result.bind="result"></au-query>',
      class App {
        query = { key: ['test'], fetch };
        result: QueryResult<string> | null = null;
      },
      [AureliaQueryConfiguration]
    );

    await startPromise;

    expect(component.result).toBeInstanceOf(QueryResult);
    expect(component.result?.loading).toBe(true);

    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(component.result?.data).toBe('ok');

    await tearDown();
  });

  test('query binding command assigns result to bindable target', async () => {
    const fetch = jest.fn().mockResolvedValue('ok');

    const { appHost, startPromise, tearDown } = createFixture(
      '<result-host result.query="query"></result-host>',
      class App {
        query = { key: ['command'], fetch };
      },
      [AureliaQueryConfiguration, ResultHost]
    );

    await startPromise;

    const hostEl = appHost.querySelector('result-host') as HTMLElement;
    const hostVm = CustomElement.for(hostEl).viewModel as ResultHost;

    expect(hostVm.result).toBeInstanceOf(QueryResult);

    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(hostVm.result?.data).toBe('ok');

    await tearDown();
  });

  test('query respects enabled=false until refetch', async () => {
    const fetch = jest.fn().mockResolvedValue('ok');

    const { component, startPromise, tearDown } = createFixture(
      '<au-query query.bind="query" result.bind="result"></au-query>',
      class App {
        query = { key: ['disabled'], fetch, enabled: false };
        result: QueryResult<string> | null = null;
      },
      [AureliaQueryConfiguration]
    );

    await startPromise;

    expect(fetch).toHaveBeenCalledTimes(0);
    expect(component.result?.status).toBe('idle');

    await component.result?.refetch();
    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(component.result?.data).toBe('ok');

    await tearDown();
  });
});
