export class MockExecutionContext {
  readonly promises: Promise<unknown>[] = [];
  passThroughOnExceptionCalled = false;
  props: unknown = {};
  exports?: unknown;

  waitUntil(promise: Promise<unknown>) {
    this.promises.push(promise);
  }

  passThroughOnException() {
    this.passThroughOnExceptionCalled = true;
  }

  async drain() {
    const pending = this.promises.splice(0, this.promises.length);
    return Promise.allSettled(pending);
  }
}

export const mockExecutionContext = () => new MockExecutionContext();
