import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";

import type {
  BrowserExtensionMessage,
  BrowserExtensionRequest,
} from "@/types/browser-connector-json.types.js";

type NativeMessagingConnectionEvents = {
  message: [BrowserExtensionMessage];
  close: [];
};

export class NativeMessagingConnection extends EventEmitter<NativeMessagingConnectionEvents> {
  private buffer = Buffer.alloc(0);

  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
  ) {
    super();
  }

  start = (): void => {
    this.input.on("data", this.handleData);
    this.input.on("end", this.handleClose);
    this.input.on("close", this.handleClose);
  };

  send = (message: BrowserExtensionRequest): void => {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.byteLength, 0);
    this.output.write(Buffer.concat([header, body]));
  };

  private handleData = (chunk: Buffer): void => {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.byteLength >= 4) {
      const messageLength = this.buffer.readUInt32LE(0);

      if (this.buffer.byteLength < messageLength + 4) {
        return;
      }

      const body = this.buffer.subarray(4, 4 + messageLength);
      this.buffer = this.buffer.subarray(4 + messageLength);
      this.emit(
        "message",
        JSON.parse(body.toString("utf8")) as BrowserExtensionMessage,
      );
    }
  };

  private handleClose = (): void => {
    this.emit("close");
  };
}
