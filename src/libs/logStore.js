import { createSignal } from "solid-js";

export const [logEntries, setLogEntries] = createSignal([]);
const MAX_LOG = 200;

export function pushLog(msg, kind = "inf") {
  setLogEntries((prev) => {
    const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const next = prev.concat([{ ts, kind, msg }]);
    return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
  });
}

export function clearLog() {
  setLogEntries([]);
}

const fmt = (a) =>
  Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");

export function logTx(reportId, data) {
  pushLog(`TX \u2192 [${reportId}] ${fmt(data)}`, "tx");
}

export function logRx(reportId, data) {
  if (data && data.length) pushLog(`RX \u2190 [${reportId}] ${fmt(data)}`, "rx");
}

export function logInfo(msg) {
  pushLog(msg, "inf");
}

export function logWarn(msg) {
  pushLog(msg, "warn");
}

export function logError(msg) {
  pushLog(msg, "err");
}
