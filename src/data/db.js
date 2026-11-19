// IndexedDB：资料只存在这台设备的浏览器里。
// 「后端」只有三个动作：getAll / put / delete。测试时换成 memoryBackend。

const DB_NAME = 'expenses-tracker';
const DB_VERSION = 1;

export const STORE_NAMES = Object.freeze(['transactions', 'categories', 'recurring', 'settings', 'investments']);
const KEY_PATHS = { settings: 'key' };

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('写入被取消'));
  });
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('这个浏览器不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORE_NAMES) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: KEY_PATHS[name] ?? 'id' });
        if (name === 'transactions') store.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 另一个分页要升级资料库时，先关掉这边的连线。
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('资料库被另一个分页占用，请关掉其他分页再试'));
  });
}

export function idbBackend(db) {
  return {
    getAll(storeName) {
      return request(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
    },
    async put(storeName, value) {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      await transactionDone(tx);
    },
    async delete(storeName, key) {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      await transactionDone(tx);
    },
  };
}

/** 放在内存里的后端：测试用，或浏览器不能存资料时（例如无痕模式）的备用方案。 */
export function memoryBackend(initial = {}) {
  const stores = new Map(STORE_NAMES.map((name) => [name, new Map()]));
  const keyOf = (name, value) => value[KEY_PATHS[name] ?? 'id'];
  for (const [name, values] of Object.entries(initial)) {
    for (const v of values) stores.get(name).set(keyOf(name, v), structuredClone(v));
  }
  return {
    async getAll(name) {
      return [...stores.get(name).values()].map((v) => structuredClone(v));
    },
    async put(name, value) {
      stores.get(name).set(keyOf(name, value), structuredClone(value));
    },
    async delete(name, key) {
      stores.get(name).delete(key);
    },
  };
}
