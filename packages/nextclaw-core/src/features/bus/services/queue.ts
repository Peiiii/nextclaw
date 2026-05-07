import type { InboundMessage, OutboundMessage } from "./events.js";

class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: Array<(value: T) => void> = [];

  enqueue(item: T): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
    } else {
      this.items.push(item);
    }
  }

  async dequeue(): Promise<T> {
    if (this.items.length > 0) {
      return this.items.shift() as T;
    }
    return new Promise<T>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  size(): number {
    return this.items.length;
  }
}

export class MessageBus {
  private inboundQueue = new AsyncQueue<InboundMessage>();
  private outboundQueue = new AsyncQueue<OutboundMessage>();
  private outboundSubscribers: Record<string, Array<(msg: OutboundMessage) => Promise<void>>> = {};
  private running = false;

  async publishInbound(msg: InboundMessage): Promise<void> {
    this.inboundQueue.enqueue(msg);
  }

  async consumeInbound(): Promise<InboundMessage> {
    return this.inboundQueue.dequeue();
  }

  async publishOutbound(msg: OutboundMessage): Promise<void> {
    this.outboundQueue.enqueue(msg);
  }

  async consumeOutbound(): Promise<OutboundMessage> {
    return this.outboundQueue.dequeue();
  }

  subscribeOutbound(channel: string, callback: (msg: OutboundMessage) => Promise<void>): void {
    if (!this.outboundSubscribers[channel]) {
      this.outboundSubscribers[channel] = [];
    }
    this.outboundSubscribers[channel].push(callback);
  }

  async dispatchOutbound(): Promise<void> {
    this.running = true;
    while (this.running) {
      const msg = await this.consumeOutbound();
      const subscribers = this.outboundSubscribers[msg.channel] ?? [];
      for (const callback of subscribers) {
        try {
          await callback(msg);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`Error dispatching to ${msg.channel}: ${String(err)}`);
        }
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  get inboundSize(): number {
    return this.inboundQueue.size();
  }

  get outboundSize(): number {
    return this.outboundQueue.size();
  }
}
