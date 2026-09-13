import { copyBuffer, toBytes, toStream } from "./shared";

export type KVValueType = "text" | "json" | "arrayBuffer" | "stream";

export interface MockKVPutOptions<Metadata = unknown> {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Metadata;
}

export interface MockKVGetOptions {
  type?: KVValueType;
  cacheTtl?: number;
}

export interface MockKVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface MockKVKey<Metadata = unknown> {
  name: string;
  expiration?: number;
  metadata?: Metadata;
}

type StoredKVValue<Metadata> = {
  value: Uint8Array;
  expiration?: number;
  metadata?: Metadata;
};

const decodeCursor = (cursor?: string) => {
  if (!cursor) return 0;
  const offset = Number.parseInt(cursor, 10);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
};

export class MockKVNamespace<Metadata = unknown> {
  readonly #store = new Map<string, StoredKVValue<Metadata>>();

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options: MockKVPutOptions<Metadata> = {},
  ) {
    if (!key) throw new TypeError("KV key cannot be empty");
    const now = Math.floor(Date.now() / 1000);
    const expiration = options.expiration ??
      (options.expirationTtl ? now + options.expirationTtl : undefined);
    this.#store.set(key, {
      value: await toBytes(value),
      expiration,
      metadata: options.metadata,
    });
  }

  async get<T = unknown>(
    key: string,
    typeOrOptions: KVValueType | MockKVGetOptions = "text",
  ): Promise<string | T | ArrayBuffer | ReadableStream<Uint8Array> | null> {
    const entry = this.#read(key);
    if (!entry) return null;
    const type = typeof typeOrOptions === "string"
      ? typeOrOptions
      : typeOrOptions.type ?? "text";
    if (type === "arrayBuffer") return copyBuffer(entry.value);
    if (type === "stream") return toStream(entry.value);
    const text = new TextDecoder().decode(entry.value);
    if (type === "json") return JSON.parse(text) as T;
    return text;
  }

  async getWithMetadata<T = unknown>(
    key: string,
    typeOrOptions: KVValueType | MockKVGetOptions = "text",
  ) {
    const entry = this.#read(key);
    if (!entry) return { value: null, metadata: null };
    return {
      value: await this.get<T>(key, typeOrOptions),
      metadata: entry.metadata ?? null,
    };
  }

  async delete(key: string) {
    this.#store.delete(key);
  }

  async list(options: MockKVListOptions = {}) {
    this.#removeExpired();
    const offset = decodeCursor(options.cursor);
    const limit = Math.max(1, Math.min(options.limit ?? 1000, 1000));
    const keys = [...this.#store.entries()]
      .filter(([name]) => name.startsWith(options.prefix ?? ""))
      .sort(([left], [right]) => left.localeCompare(right));
    const page = keys.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      keys: page.map(([name, entry]): MockKVKey<Metadata> => ({
        name,
        expiration: entry.expiration,
        metadata: entry.metadata,
      })),
      list_complete: nextOffset >= keys.length,
      cursor: nextOffset < keys.length ? String(nextOffset) : "",
      cacheStatus: null,
    };
  }

  has(key: string) {
    return Boolean(this.#read(key));
  }

  size() {
    this.#removeExpired();
    return this.#store.size;
  }

  clear() {
    this.#store.clear();
  }

  #read(key: string) {
    const entry = this.#store.get(key);
    if (!entry) return undefined;
    if (entry.expiration && entry.expiration <= Math.floor(Date.now() / 1000)) {
      this.#store.delete(key);
      return undefined;
    }
    return entry;
  }

  #removeExpired() {
    for (const key of this.#store.keys()) this.#read(key);
  }
}

export const mockKV = <Metadata = unknown>() => new MockKVNamespace<Metadata>();
