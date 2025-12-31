import { DI } from "@aurelia/kernel";
import { AureliaHooks, AureliaHooksConfiguration, IAureliaHooks } from "./../src";

describe("Aurelia Hooks", () => {
  let sut: AureliaHooks;

  beforeEach(() => {
    sut = new AureliaHooks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Configuration", () => {
    test("registers AureliaHooks under the interface alias", () => {
      const container = DI.createContainer();

      AureliaHooksConfiguration.register(container);

      const hooksByInterface = container.get(IAureliaHooks);
      const hooksByClass = container.get(AureliaHooks);

      expect(hooksByInterface).toBe(hooksByClass);
    });
  });

  describe("Actions", () => {
    test("adds new action with default priority", () => {
      sut.addAction("test", jest.fn());

      const actions = sut.getActions("test");

      expect(actions[0].priority).toEqual(10);
    });

    test("adds new action with priority of 2", () => {
      sut.addAction("test", jest.fn(), 2);

      const actions = sut.getActions("test");

      expect(actions[0].priority).toEqual(2);
    });

    test("has registered action", () => {
      sut.addAction("test", jest.fn(), 2);

      expect(sut.hasAction("test")).toBeTruthy();
    });

    test("does not have registered action", () => {
      expect(sut.hasAction("test")).toBeFalsy();
    });

    test("register single action and call it", () => {
      const callback = jest.fn();

      sut.addAction("testme", callback);

      sut.doAction("testme");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("register multiple actions and call them", () => {
      const callback = jest.fn();

      sut.addAction("testme", callback);
      sut.addAction("testme", callback);

      sut.doAction("testme");

      expect(callback).toHaveBeenCalledTimes(2);
    });

    test("register multiple actions with custom priorities", async () => {
      const callOrder: number[] = [];
      const callback = jest.fn().mockImplementation(() => callOrder.push(1));
      const callback2 = jest.fn().mockImplementation(() => callOrder.push(2));

      sut.addAction("testme", callback);
      sut.addAction("testme", callback2, 1);

      sut.doAction("testme");

      expect(callOrder).toEqual([2, 1]);
    });

    test("register multiple actions with same priority preserves registration order", () => {
      const callOrder: number[] = [];
      const callback = jest.fn().mockImplementation(() => callOrder.push(1));
      const callback2 = jest.fn().mockImplementation(() => callOrder.push(2));

      sut.addAction("testme", callback, 5);
      sut.addAction("testme", callback2, 5);

      sut.doAction("testme");

      expect(callOrder).toEqual([1, 2]);
    });

    test("removeAction should remove action", () => {
      const callback = jest.fn();

      sut.addAction("testme", callback);
      sut.removeAction("testme", callback);

      sut.doAction("testme");

      expect(callback).not.toHaveBeenCalled();
      expect(sut.hasAction("testme")).toBeFalsy();
    });

    test("removeAction should only remove the matching callback", () => {
      const callback = jest.fn();
      const callback2 = jest.fn();

      sut.addAction("testme", callback);
      sut.addAction("testme", callback2);
      sut.removeAction("testme", callback);

      sut.doAction("testme");

      expect(callback).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("removeAction called on non-existent action should set empty array", () => {
      const callback = jest.fn();

      sut.removeAction("testme", callback);

      const actions = sut.getActions("testme");

      expect(Array.isArray(actions)).toBeFalsy();
    });
  });

  describe("Filters", () => {
    test("adds new filter with default priority", () => {
      sut.addFilter("test", jest.fn());

      expect(sut.hasFilter("test")).toBeTruthy();

      const filters = sut.getFilters("test");

      expect(filters[0].priority).toEqual(10);
    });

    test("adds new filter with priority of 2", () => {
      sut.addFilter("test", jest.fn(), 2);

      expect(sut.hasFilter("test")).toBeTruthy();

      const actions = sut.getFilters("test");

      expect(actions[0].priority).toEqual(2);
    });

    test("register single filter and call it", () => {
      const callback = jest.fn();

      sut.addFilter("testme", callback);

      sut.applyFilter("testme", "test");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("register multiple filters and call them", () => {
      const callback = jest.fn();

      sut.addFilter("testme", callback);
      sut.addFilter("testme", callback);

      sut.applyFilter("testme", "testme");

      expect(callback).toHaveBeenCalledTimes(2);
    });

    test("register multiple filters with custom priorities", async () => {
      const callOrder = [];
      const callback = jest.fn().mockImplementation(() => callOrder.push(1));
      const callback2 = jest.fn().mockImplementation(() => callOrder.push(2));

      sut.addFilter("testme", callback);
      sut.addFilter("testme", callback2, 1);

      sut.applyFilter("testme", "testahhh");

      expect(callOrder).toEqual([2, 1]);
    });

    test("register multiple filters with same priority preserves registration order", () => {
      const callOrder: number[] = [];
      const callback = jest.fn().mockImplementation(() => callOrder.push(1));
      const callback2 = jest.fn().mockImplementation(() => callOrder.push(2));

      sut.addFilter("testme", callback, 5);
      sut.addFilter("testme", callback2, 5);

      sut.applyFilter("testme", "testahhh");

      expect(callOrder).toEqual([1, 2]);
    });

    test("applyfilter should transform value from 1 to 2", () => {
      const callback = jest.fn().mockImplementation((val: number) => {
        return val + 1;
      });

      sut.addFilter("increment", callback);

      const value = sut.applyFilter("increment", 1);

      expect(value).toEqual(2);
    });

    test("applyfilter should transform value from 1 to 3", () => {
      const callback = jest.fn().mockImplementation((val: number) => {
        return val + 1;
      });

      sut.addFilter("increment", callback);
      sut.addFilter("increment", callback);

      const value = sut.applyFilter("increment", 1);

      expect(value).toEqual(3);
    });

    test("applyfilter should return default value if no callback supplied", () => {
      const value = sut.applyFilter("increment", 1);

      expect(value).toEqual(1);
    });

    test("applyFilterAsync should resolve promise and return default value if no callback supplied", async () => {
      const value = await sut.applyFilterAsync("increment", 1);

      expect(value).toEqual(1);
    });

    test("applyFilterAsync should resolve promise and return callback value", async () => {
      sut.addFilter("changed", () => "dwayne");
      const value = await sut.applyFilterAsync("changed", 1);

      expect(value).not.toEqual(1);
      expect(value).toEqual("dwayne");
    });

    test("applyFilterAsync should resolve promise and return async callback with a value", async () => {
      sut.addFilter("changed", () =>
        Promise.resolve("this is a resolved value")
      );
      const value = await sut.applyFilterAsync("changed", 1);

      expect(value).not.toEqual(1);
      expect(value).toEqual("this is a resolved value");
    });

    test("applyFilterAsync should run filters in priority order and pass along values", async () => {
      const callOrder: number[] = [];

      sut.addFilter("changed", async (value: number) => {
        callOrder.push(value);
        return value * 2;
      }, 5);

      sut.addFilter("changed", async (value: number) => {
        callOrder.push(value);
        return value + 1;
      }, 10);

      const value = await sut.applyFilterAsync("changed", 2);

      expect(callOrder).toEqual([2, 4]);
      expect(value).toEqual(5);
    });

    test("applyFilterAsync should reject if the callback supplied errors", async () => {
      sut.addFilter("changed", () => Promise.reject("there was an error"));

      await expect(sut.applyFilterAsync("changed", 1)).rejects.toBeTruthy();
    });

    test("removeFilter should remove filter", () => {
      const callback = jest.fn();

      sut.addFilter("testme", callback);
      sut.removeFilter("testme", callback);

      sut.applyFilter("testme", "nothing");

      expect(callback).not.toHaveBeenCalled();
    });

    test("removeFilter should only remove the matching callback", () => {
      const callback = jest.fn();
      const callback2 = jest.fn();

      sut.addFilter("testme", callback);
      sut.addFilter("testme", callback2);
      sut.removeFilter("testme", callback);

      sut.applyFilter("testme", "nothing");

      expect(callback).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("removeFilter called on non-existent filter should set empty array", () => {
      const callback = jest.fn();

      sut.removeFilter("testme", callback);

      const filters = sut.getFilters("testme");

      expect(Array.isArray(filters)).toBeFalsy();
    });
  });
});
