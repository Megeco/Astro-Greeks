"use client";
export const STORE_KEY = "fin-lumen-workbench-v1";
export type Workspace = {
  records: any[];
  packs: any[];
  quarters: any[];
  reveals: any[];
  notes: any[];
};
export const emptyWorkspace: Workspace = {
  records: [],
  packs: [],
  quarters: [],
  reveals: [],
  notes: [],
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STORE_KEY, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("workspace");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function readWorkspace(): Promise<Workspace> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly"),
      req = tx.objectStore("workspace").get("current");
    req.onsuccess = () =>
      resolve(req.result || structuredClone(emptyWorkspace));
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeWorkspace(data: Workspace) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(data, "current");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const keys = Array.from(new Set(rows.flatMap(Object.keys)));
  const quote = (x: any) =>
    '"' +
    String(
      x === null || x === undefined
        ? ""
        : typeof x === "object"
          ? JSON.stringify(x)
          : x,
    ).replaceAll('"', '""') +
    '"';
  return [
    keys.map(quote).join(","),
    ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
  ].join("\r\n");
}
export async function api(op: string, data: Record<string, any> = {}) {
  const r = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...data }),
  });
  const x = await r.json();
  if (!r.ok) throw Error(x.error || "Request failed");
  return x;
}
