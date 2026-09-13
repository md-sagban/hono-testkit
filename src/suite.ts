import {
  createHonoTestHarness,
  type HonoRequestBuilder,
  type HonoRequestTarget,
  type HonoTestHarness,
} from "./hono";

type BindingFactory<Bindings> = () => Bindings | Promise<Bindings>;

type Resettable = {
  clear?: () => unknown;
  close?: () => unknown;
};

const disposeBindings = async (bindings: object) => {
  for (const binding of Object.values(bindings) as Resettable[]) {
    if (!binding || typeof binding !== "object") continue;
    if (typeof binding.clear === "function") await binding.clear();
    if (typeof binding.close === "function") await binding.close();
  }
};

export interface HonoTestSuite<Bindings extends object> {
  readonly bindings: Bindings;
  readonly executionContext: HonoTestHarness<Bindings>["executionContext"];
  reset(): Promise<void>;
  dispose(): Promise<void>;
  request(input: string | Request, init?: RequestInit): Promise<Response>;
  get(path: string, init?: RequestInit): Promise<Response>;
  post(path: string, body?: unknown, init?: RequestInit): Promise<Response>;
  build(path: string): HonoRequestBuilder;
}

export const createHonoTestSuite = async <Bindings extends object>(
  app: HonoRequestTarget<NoInfer<Bindings>>,
  factory: BindingFactory<Bindings>,
): Promise<HonoTestSuite<Bindings>> => {
  let bindings = await factory();
  let harness = createHonoTestHarness(app, bindings);

  return {
    get bindings() {
      return bindings;
    },
    get executionContext() {
      return harness.executionContext;
    },
    async reset() {
      await harness.executionContext.drain();
      await disposeBindings(bindings);
      bindings = await factory();
      harness = createHonoTestHarness(app, bindings);
    },
    async dispose() {
      await harness.executionContext.drain();
      await disposeBindings(bindings);
    },
    request: (input, init) => harness.request(input, init),
    get: (path, init) => harness.get(path, init),
    post: (path, body, init) => harness.post(path, body, init),
    build: (path) => harness.build(path),
  };
};
