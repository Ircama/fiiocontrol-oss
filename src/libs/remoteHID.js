/**
 * remoteHID.js — Remote HID transport over WebSocket (aura-bridged backend).
 *
 * Same wire protocol as Audiocular-Aura's remote.ts / kt02h20-control:
 *   C→S  {"cmd":"list"}
 *   C→S  {"cmd":"open","vendorId":N,"productId":N}
 *   C→S  {"cmd":"send_report","reportId":N,"data":[...]}
 *   C→S  {"cmd":"send_feature_report","reportId":N,"data":[...]}
 *   C→S  {"cmd":"close"}
 *   S→C  {"type":"device_list","devices":[...]}
 *   S→C  {"type":"opened","vendorId":N,"productId":N,"productName":"..."}
 *   S→C  {"type":"input_report","reportId":N,"data":[...]}
 *   S→C  {"type":"error","message":"..."}
 *   S→C  {"type":"closed"}
 *
 * This lets the app control a DAC attached to a remote (or local) Linux host
 * running the aura-bridged WebSocket ↔ HID bridge, without WebHID.
 */

const CONN_MODE_KEY = "fiiocontrol_conn_mode";
const REMOTE_URL_KEY = "fiiocontrol_remote_url";

export const DEFAULT_REMOTE_URL = "ws://localhost:9001";

export const ConnectionMode = {
  _mode: (() => {
    try {
      return localStorage.getItem(CONN_MODE_KEY) === "remote" ? "remote" : "local";
    } catch {
      return "local";
    }
  })(),
  get mode() {
    return this._mode;
  },
  set(mode) {
    this._mode = mode === "remote" ? "remote" : "local";
    try {
      localStorage.setItem(CONN_MODE_KEY, this._mode);
    } catch {}
  },
};

export const RemotePrefs = {
  get url() {
    try {
      return localStorage.getItem(REMOTE_URL_KEY) || DEFAULT_REMOTE_URL;
    } catch {
      return DEFAULT_REMOTE_URL;
    }
  },
  set url(v) {
    try {
      localStorage.setItem(REMOTE_URL_KEY, (v || DEFAULT_REMOTE_URL).trim() || DEFAULT_REMOTE_URL);
    } catch {}
  },
};

function remoteSendJson(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return new Uint8Array(data);
  return new Uint8Array(0);
}

/**
 * Mimics the subset of HIDDevice used by the drivers, backed by a WebSocket
 * connection to the aura-bridged backend.
 */
export class RemoteHIDDevice {
  constructor(vendorId, productId, productName, ws) {
    this.vendorId = vendorId;
    this.productId = productId;
    this.productName = productName;
    this.collections = [];
    this.opened = true;
    this._ws = ws;
    this._handlers = new Map(); // 'inputreport' -> Set<{handler, once}>
  }

  async open() {
    this.opened = true;
  }

  async close() {
    this.opened = false;
    remoteSendJson(this._ws, { cmd: "close" });
    try {
      this._ws.close();
    } catch {}
    this._handlers.clear();
  }

  async sendReport(reportId, data) {
    remoteSendJson(this._ws, { cmd: "send_report", reportId, data: Array.from(toBytes(data)) });
  }

  async sendFeatureReport(reportId, data) {
    remoteSendJson(this._ws, { cmd: "send_feature_report", reportId, data: Array.from(toBytes(data)) });
  }

  addEventListener(type, handler, options) {
    if (type !== "inputreport" || typeof handler !== "function") return;
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add({ handler, once: !!(options && options.once) });
  }

  removeEventListener(type, handler) {
    if (type !== "inputreport") return;
    const set = this._handlers.get(type);
    if (!set) return;
    for (const h of [...set]) if (h.handler === handler) set.delete(h);
  }

  _dispatchInputReport(reportId, data) {
    const set = this._handlers.get("inputreport");
    if (!set) return;
    let bytes = toBytes(data);
    // The aura-bridged backend forwards the raw hid_read buffer, which for
    // numbered input reports starts with the report ID byte (data[0] ===
    // reportId). WebHID strips that byte from inputreport events, so strip it
    // here too to keep local and remote response parsing identical.
    if (bytes.length > 0 && reportId !== 0 && bytes[0] === reportId) {
      bytes = bytes.subarray(1);
    }
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const event = { reportId, data: new DataView(buffer) };
    for (const h of [...set]) {
      if (h.once) this.removeEventListener("inputreport", h.handler);
      try {
        h.handler(event);
      } catch (e) {
        console.error("[RemoteHID] handler error:", e);
      }
    }
  }
}

/** List HID devices available on the remote backend (without opening). */
export function listRemoteDevices(url) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e);
      return;
    }
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("connection timeout"));
    }, 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      remoteSendJson(ws, { cmd: "list" });
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "device_list") {
          try {
            ws.close();
          } catch {}
          resolve(msg.devices || []);
        } else if (msg.type === "error") {
          try {
            ws.close();
          } catch {}
          reject(new Error(msg.message || "backend error"));
        }
      } catch {
        try {
          ws.close();
        } catch {}
        reject(new Error("invalid backend response"));
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("websocket connection failed"));
    };
    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}

/** Open a specific HID device on the remote backend. */
export function openRemoteDevice(vendorId, productId, url, onClosed) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e);
      return;
    }
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("connection timeout"));
    }, 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      remoteSendJson(ws, { cmd: "open", vendorId, productId });
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "opened") {
        const dev = new RemoteHIDDevice(
          msg.vendorId ?? vendorId,
          msg.productId ?? productId,
          msg.productName || "remote device",
          ws,
        );
        ws.onmessage = (ev2) => {
          let m;
          try {
            m = JSON.parse(ev2.data);
          } catch {
            return;
          }
          if (m.type === "input_report") dev._dispatchInputReport(m.reportId ?? 0, m.data || []);
          else if (m.type === "closed") {
            dev.opened = false;
            onClosed?.();
          }
        };
        ws.onclose = () => {
          dev.opened = false;
          onClosed?.();
        };
        resolve(dev);
      } else if (msg.type === "error") {
        try {
          ws.close();
        } catch {}
        reject(new Error(msg.message || "failed to open device"));
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("websocket connection failed"));
    };
    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}
