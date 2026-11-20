import { bindable, customElement, CustomElement } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { AureliaQueryConfiguration, IQueryClient, QueryResult } from './../src/index';

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

    const { component, container, startPromise, tearDown } = createFixture(
      '<au-query query.bind="query" result.bind="result"></au-query>',
      class App {
        query = { key: ['test'], fetch, cacheTime: 0 };
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

    const client = container.get(IQueryClient);
    const key = client.hashKey(component.query.key);
    expect(client.getEntry(key)?.observers.size).toBe(1);

    await tearDown();
    await flush();
    expect(client.getEntry(key)).toBeUndefined();
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

  test('exposes background failures and lets manual refetch reject', async () => {
    const error = new Error('Fetch failed');
    const fetch = jest.fn().mockRejectedValue(error);
    const { component, startPromise, tearDown } = createFixture(
      '<au-query query.bind="query" result.bind="result"></au-query>',
      class App {
        query = { key: 'failure', fetch };
        result: QueryResult | null = null;
      },
      [AureliaQueryConfiguration]
    );

    await startPromise;
    await flush();
    expect(component.result).toMatchObject({ status: 'error', error, loading: false });
    await expect(component.result?.refetch()).rejects.toBe(error);
    await tearDown();
  });

  test('keeps the newest result when an earlier request finishes last', async () => {
    let resolveFirst!: (value: string) => void;
    const first = new Promise<string>((resolve) => { resolveFirst = resolve; });
    const fetch = jest.fn().mockReturnValueOnce(first).mockResolvedValueOnce('new');
    const { component, startPromise, tearDown } = createFixture(
      '<au-query query.bind="query" result.bind="result"></au-query>',
      class App {
        query = { key: 'overlapping', fetch };
        result: QueryResult<string> | null = null;
      },
      [AureliaQueryConfiguration]
    );

    await startPromise;
    await expect(component.result?.refetch()).resolves.toBe('new');
    resolveFirst('old');
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(component.result?.data).toBe('new');
    await tearDown();
  });
});
