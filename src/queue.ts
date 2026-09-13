export interface MockQueueMessage<Body> {
  body: Body;
  contentType?: "text" | "json" | "bytes" | "v8";
  delaySeconds?: number;
  timestamp: Date;
}

export interface MockQueueSendOptions {
  contentType?: "text" | "json" | "bytes" | "v8";
  delaySeconds?: number;
}

export class MockQueue<Body = unknown> {
  readonly messages: MockQueueMessage<Body>[] = [];

  async send(body: Body, options: MockQueueSendOptions = {}) {
    this.messages.push({ body, ...options, timestamp: new Date() });
  }

  async sendBatch(
    batch: Array<{ body: Body } & MockQueueSendOptions>,
  ) {
    for (const message of batch) {
      await this.send(message.body, message);
    }
  }

  clear() {
    this.messages.length = 0;
  }

  drain() {
    return this.messages.splice(0, this.messages.length);
  }
}

export const mockQueue = <Body = unknown>() => new MockQueue<Body>();
