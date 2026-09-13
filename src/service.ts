export type MockServiceHandler = (
  request: Request,
) => Response | Promise<Response>;

export class MockServiceBinding {
  readonly requests: Request[] = [];
  #handler: MockServiceHandler;
  #nextError: unknown;

  constructor(handler: MockServiceHandler) {
    this.#handler = handler;
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    const request = input instanceof Request
      ? new Request(input, init)
      : new Request(input, init);
    this.requests.push(request.clone() as Request);

    if (this.#nextError !== undefined) {
      const error = this.#nextError;
      this.#nextError = undefined;
      throw error;
    }

    return this.#handler(request as Request);
  }

  respondWith(handler: MockServiceHandler) {
    this.#handler = handler;
  }

  failNext(error: unknown = new Error("Mock service failure")) {
    this.#nextError = error;
  }

  clear() {
    this.requests.length = 0;
    this.#nextError = undefined;
  }

  get lastRequest() {
    return this.requests.at(-1) ?? null;
  }
}

export const mockService = (handler: MockServiceHandler) =>
  new MockServiceBinding(handler);
