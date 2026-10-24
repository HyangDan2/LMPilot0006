import type { ChatSession, ChatSettings } from './types';

const DB_NAME = 'lmpilot-web';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';
const SETTINGS_KEY = 'lmpilot-web-settings-v1';
const APP_CACHE_PREFIX = 'lmpilot-web-';

export const DEFAULT_SETTINGS: ChatSettings = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  modelName: '',
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열지 못했습니다.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('저장 작업에 실패했습니다.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('저장 작업이 취소되었습니다.'));
  });
}

export const sessionStore = {
  async list(): Promise<ChatSession[]> {
    const db = await openDatabase();
    const tx = db.transaction(SESSION_STORE, 'readonly');
    const result = await new Promise<ChatSession[]>((resolve, reject) => {
      const request = tx.objectStore(SESSION_STORE).getAll();
      request.onsuccess = () => resolve(request.result as ChatSession[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async save(session: ChatSession): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).put(session);
    await transactionDone(tx);
    db.close();
  },

  async delete(id: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).delete(id);
    await transactionDone(tx);
    db.close();
  },

  async deleteAll(): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).clear();
    await transactionDone(tx);
    db.close();
  },
};

export function loadSettings(): ChatSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ChatSettings): void {
  // Deliberately persist only non-secret connection preferences.
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function clearAppData(): Promise<void> {
  await sessionStore.deleteAll();
  localStorage.removeItem(SETTINGS_KEY);
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith(APP_CACHE_PREFIX)).map((name) => caches.delete(name)),
    );
  }
}
