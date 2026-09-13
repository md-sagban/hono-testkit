import { mockExecutionContext, type MockExecutionContext } from "./execution-context";

export interface HonoRequestTarget<Bindings> {
  request(
    input: string | Request,
    init?: RequestInit,
    bindings?: Bindings,
    executionContext?: MockExecutionContext,
  ): Response | Promise<Response>;
}

export interface HonoTestHarness<Bindings> {
  readonly bindings: Bindings;
  readonly executionContext: MockExecutionContext;
  request(input: string | Request, init?: RequestInit): Promise<Response>;
  get(path: string, init?: RequestInit): Promise<Response>;
  post(path: string, body?: unknown, init?: RequestInit): Promise<Response>;
  build(path: string): HonoRequestBuilder;
}

export interface HonoRequestBuilder {
  header(name: string, value: string): HonoRequestBuilder;
  headers(values: HeadersInit): HonoRequestBuilder;
  bearer(token: string): HonoRequestBuilder;
  cookie(name: string, value: string): HonoRequestBuilder;
  json(value: unknown): HonoRequestBuilder;
  formData(value: FormData): HonoRequestBuilder;
  body(value: BodyInit | null): HonoRequestBuilder;
  send(method?: string): Promise<Response>;
  get(): Promise<Response>;
  post(): Promise<Response>;
  put(): Promise<Response>;
  patch(): Promise<Response>;
  delete(): Promise<Response>;
}

const isBodyInit = (body: unknown): body is BodyInit =>
  typeof body === "string" ||
  body instanceof Blob ||
  body instanceof FormData ||
  body instanceof URLSearchParams ||
  body instanceof ArrayBuffer ||
  ArrayBuffer.isView(body) ||
  body instanceof ReadableStream;

const createRequestBuilder = (
  sendRequest: (input: string, init?: RequestInit) => Promise<Response>,
  path: string,
): HonoRequestBuilder => {
  const headers = new Headers();
  let body: BodyInit | null | undefined;

  const builder: HonoRequestBuilder = {
    header(name, value) {
      headers.set(name, value);
      return builder;
    },
    headers(values) {
      new Headers(values).forEach((value, key) => headers.set(key, value));
      return builder;
    },
    bearer(token) {
      headers.set("authorization", `Bearer ${token}`);
      return builder;
    },
    cookie(name, value) {
      const current = headers.get("cookie");
      headers.set("cookie", `${current ? `${current}; ` : ""}${name}=${value}`);
      return builder;
    },
    json(value) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(value);
      return builder;
    },
    formData(value) {
      headers.delete("content-type");
      body = value;
      return builder;
    },
    body(value) {
      body = value;
      return builder;
    },
    send(method = "GET") {
      return sendRequest(path, { method, headers, body });
    },
    get: () => builder.send("GET"),
    post: () => builder.send("POST"),
    put: () => builder.send("PUT"),
    patch: () => builder.send("PATCH"),
    delete: () => builder.send("DELETE"),
  };

  return builder;
};

export const createHonoTestHarness = <Bindings extends object>(
  app: HonoRequestTarget<NoInfer<Bindings>>,
  bindings: Bindings,
): HonoTestHarness<Bindings> => {
  const executionContext = mockExecutionContext();
  const request = (input: string | Request, init?: RequestInit) =>
    Promise.resolve(app.request(input, init, bindings, executionContext));

  return {
    bindings,
    executionContext,
    request,
    get: (path, init) => request(path, { ...init, method: "GET" }),
    post: (path, body, init) => {
      const shouldEncodeJson = body !== undefined && !isBodyInit(body);
      const headers = new Headers(init?.headers);
      if (shouldEncodeJson && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      return request(path, {
        ...init,
        method: "POST",
        headers,
        body: body === undefined
          ? init?.body
          : isBodyInit(body)
            ? body
            : JSON.stringify(body),
      });
    },
    build: (path) => createRequestBuilder(request, path),
  };
};
