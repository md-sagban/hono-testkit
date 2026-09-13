export const toBytes = async (
  value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream,
): Promise<Uint8Array> => {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (value instanceof ReadableStream) {
    return new Uint8Array(await new Response(value).arrayBuffer());
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return new Uint8Array(value.slice(0));
};

export const copyBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const toStream = (bytes: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice());
      controller.close();
    },
  });

export const weakEtag = (bytes: Uint8Array) => {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
};
