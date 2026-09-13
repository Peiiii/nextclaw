import { readFile } from "node:fs/promises";
export const contractVersion = 1;
export const adapterId = "local-alert";
/** A one-way non-forum source, installed without changing the host. */
export class LocalAlertSource {
  id = adapterId;
  constructor(connection) { this.connection = connection; this.source = "urn:local-alert:" + connection.options.namespace; }
  read = async () => JSON.parse(await readFile(this.connection.options.input, "utf8"));
  check = async () => ({ source: this.source, account: "local-producer", writable: false, editableStatus: false });
  collect = async checkpoint => {
    const alert = await this.read();
    return { checkpoint: String(alert.revision), events: String(alert.revision) === checkpoint ? [] : [{ specversion: "1.0", source: this.source, subject: alert.id, id: `${alert.id}:${alert.revision}`, type: "alert.changed", time: new Date().toISOString(), data: { actor: { account: "local-producer" }, body: alert.message, resourceId: alert.id, change: "message", invited: true } }] };
  };
  readContext = async subject => { const alert = await this.read(); return { subject, title: "Local alert " + subject, url: "urn:local-alert:" + subject, body: alert.message, invited: true, closed: false, messages: [] }; };
}
export const createSource = connection => new LocalAlertSource(connection);
