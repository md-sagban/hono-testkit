import { copyBuffer, toBytes, toStream, weakEtag } from "./shared";

export interface MockR2PutOptions {
  httpMetadata?: MockR2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface MockR2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
  [key: string]: string | Date | undefined;
}

type StoredR2Object = {
  bytes: Uint8Array;
  uploaded: Date;
  etag: string;
  version: string;
  httpMetadata: MockR2HTTPMetadata;
  customMetadata: Record<string, string>;
};

export class MockR2Object {
  readonly key: string;
  readonly version: string;
  readonly size: number;
  readonly etag: string;
  readonly httpEtag: string;
  readonly uploaded: Date;
  readonly httpMetadata: MockR2HTTPMetadata;
  readonly customMetadata: Record<string, string>;
  readonly #bytes: Uint8Array;

  constructor(key: string, stored: StoredR2Object) {
    this.key = key;
    this.version = stored.version;
    this.size = stored.bytes.byteLength;
    this.etag = stored.etag;
    this.httpEtag = `"${stored.etag}"`;
    this.uploaded = new Date(stored.uploaded);
    this.httpMetadata = { ...stored.httpMetadata };
    this.customMetadata = { ...stored.customMetadata };
    this.#bytes = stored.bytes.slice();
  }

  get body() {
    return toStream(this.#bytes);
  }

  async arrayBuffer() {
    return copyBuffer(this.#bytes);
  }

  async text() {
    return new TextDecoder().decode(this.#bytes);
  }

  async json<T = unknown>() {
    return JSON.parse(await this.text()) as T;
  }

  async blob() {
    return new Blob([copyBuffer(this.#bytes)]);
  }

  writeHttpMetadata(headers: Headers) {
    const headerNames: Record<string, string> = {
      contentType: "content-type",
      contentLanguage: "content-language",
      contentDisposition: "content-disposition",
      contentEncoding: "content-encoding",
      cacheControl: "cache-control",
      cacheExpiry: "expires",
    };
    for (const [key, value] of Object.entries(this.httpMetadata)) {
      if (value !== undefined) {
        headers.set(
          headerNames[key] ?? key,
          value instanceof Date ? value.toUTCString() : value,
        );
      }
    }
  }
}

export class MockR2Bucket {
  readonly #store = new Map<string, StoredR2Object>();
  #version = 0;

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream | null,
    options: MockR2PutOptions = {},
  ) {
    if (!key) throw new TypeError("R2 key cannot be empty");
    if (value === null) {
      this.#store.delete(key);
      return null;
    }
    const bytes = await toBytes(value);
    const stored: StoredR2Object = {
      bytes,
      uploaded: new Date(),
      etag: weakEtag(bytes),
      version: String(++this.#version),
      httpMetadata: { ...options.httpMetadata },
      customMetadata: { ...options.customMetadata },
    };
    this.#store.set(key, stored);
    return new MockR2Object(key, stored);
  }

  async get(key: string) {
    const stored = this.#store.get(key);
    return stored ? new MockR2Object(key, stored) : null;
  }

  async head(key: string) {
    return this.get(key);
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.#store.delete(key);
  }

  async list(options: { prefix?: string; limit?: number; cursor?: string } = {}) {
    const keys = [...this.#store.keys()]
      .filter((key) => key.startsWith(options.prefix ?? ""))
      .sort();
    const offset = Number.parseInt(options.cursor ?? "0", 10) || 0;
    const limit = Math.max(1, Math.min(options.limit ?? 1000, 1000));
    const page = keys.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      objects: page.map((key) => new MockR2Object(key, this.#store.get(key)!)),
      truncated: nextOffset < keys.length,
      cursor: nextOffset < keys.length ? String(nextOffset) : undefined,
      delimitedPrefixes: [],
    };
  }

  has(key: string) {
    return this.#store.has(key);
  }

  size() {
    return this.#store.size;
  }

  clear() {
    this.#store.clear();
  }
}

export const mockR2 = () => new MockR2Bucket();
