import { mongoDB } from '../mongoDBService';
import { cached } from '../lib/requestCache';
import { startVisibleInterval } from '../lib/polling';

export const EXPERTISE_STORAGE_KEY = 'app_expertise_fields';
export const EXPERTISE_EVENT_NAME = 'app_expertise_fields_updated';

export const DEFAULT_EXPERTISE_FIELDS: string[] = [
  "Finance & Taxation",
  "HR & Talent",
  "Tech & Digital",
  "Legal & Compliance",
  "Marketing Strategy",
  "Operations & Logistics",
  "School Mathematics",
  "Teaching & Academia",
  "Manufacturing Ops"
];

// Active subscriber callbacks for zero-latency in-memory synchronization
const listeners = new Set<(fields: string[]) => void>();
let broadcastChannel: BroadcastChannel | null = null;
let isPollingStarted = false;

// Initialize cross-tab BroadcastChannel
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    broadcastChannel = new BroadcastChannel("app_expertise_channel");
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "UPDATE" && Array.isArray(event.data.fields)) {
        expertiseService.applyFields(event.data.fields, false);
      }
    };
  } catch {}
}

export const expertiseService = {
  getAll(): string[] {
    try {
      const raw = localStorage.getItem(EXPERTISE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    try {
      localStorage.setItem(EXPERTISE_STORAGE_KEY, JSON.stringify(DEFAULT_EXPERTISE_FIELDS));
    } catch {}
    return DEFAULT_EXPERTISE_FIELDS;
  },

  applyFields(fields: string[], shouldBroadcast = true): string[] {
    const cleaned = Array.from(new Set(fields.map(f => (f || '').trim()).filter(Boolean)));
    const finalFields = cleaned.length > 0 ? cleaned : DEFAULT_EXPERTISE_FIELDS;
    try {
      localStorage.setItem(EXPERTISE_STORAGE_KEY, JSON.stringify(finalFields));
    } catch {}

    listeners.forEach(cb => {
      try { cb(finalFields); } catch {}
    });

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(EXPERTISE_EVENT_NAME, { detail: finalFields }));
      } catch {}
    }

    if (shouldBroadcast && broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: "UPDATE", fields: finalFields });
      } catch {}
    }

    return finalFields;
  },

  save(fields: string[]): string[] {
    const cleaned = this.applyFields(fields, true);
    try {
      mongoDB.syncKv(EXPERTISE_STORAGE_KEY, cleaned);
    } catch {}
    return cleaned;
  },

  async fetchFromBackend(): Promise<string[]> {
    try {
      // Cached for 60 s and shared, so focus events / several components cause one request.
      const domains = await cached('api:domains', 60_000, async () => {
        const res = await fetch('/api/domains');
        if (!res.ok) throw new Error(`/api/domains HTTP ${res.status}`);
        return res.json();
      });
      {
        if (Array.isArray(domains) && domains.length > 0) {
          const names = domains.filter((d: any) => d.is_active !== false).map((d: any) => d.name);
          this.applyFields(names, false);
          return names;
        }
      }
    } catch {}

    try {
      const serverData = await mongoDB.getKv(EXPERTISE_STORAGE_KEY);
      if (Array.isArray(serverData) && serverData.length > 0) {
        const current = this.getAll();
        if (JSON.stringify(current) !== JSON.stringify(serverData)) {
          this.applyFields(serverData, false);
        }
        return serverData;
      }
    } catch {}
    return this.getAll();
  },

  add(fieldName: string): { success: boolean; message: string; fields: string[] } {
    const trimmed = (fieldName || "").trim();
    if (!trimmed) {
      return { success: false, message: "Expertise field name cannot be empty", fields: this.getAll() };
    }
    const current = this.getAll();
    const exists = current.some(f => f.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: `Expertise field "${trimmed}" already exists`, fields: current };
    }
    const updated = [...current, trimmed];
    this.save(updated);
    try {
      fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      }).catch(() => {});
    } catch {}
    return { success: true, message: `Expertise field "${trimmed}" added successfully`, fields: updated };
  },

  delete(fieldName: string): { success: boolean; message: string; fields: string[] } {
    const trimmed = (fieldName || "").trim();
    const current = this.getAll();
    const updated = current.filter(f => f.toLowerCase() !== trimmed.toLowerCase());
    if (updated.length === current.length) {
      return { success: false, message: `Expertise field "${trimmed}" not found`, fields: current };
    }
    this.save(updated);
    try {
      fetch('/api/domains').then(r => r.json()).then(list => {
        const target = list.find((d: any) => d.name.toLowerCase() === trimmed.toLowerCase());
        if (target) {
          fetch(`/api/domains/${target.id}`, { method: 'DELETE' }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
    return { success: true, message: `Expertise field "${trimmed}" deleted successfully`, fields: updated };
  },

  reset(): string[] {
    try {
      fetch('/api/domains/reset', { method: 'POST' }).catch(() => {});
    } catch {}
    return this.save(DEFAULT_EXPERTISE_FIELDS);
  },

  subscribe(callback: (fields: string[]) => void): () => void {
    listeners.add(callback);

    // Immediately supply local synchronous state
    callback(this.getAll());

    // Immediately pull fresh authoritative taxonomy from backend server
    this.fetchFromBackend().then(fields => {
      try { callback(fields); } catch {}
    });

    const handleCustomEvent = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        callback(e.detail);
      } else {
        callback(this.getAll());
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key || e.key === EXPERTISE_STORAGE_KEY) {
        try {
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed) && parsed.length > 0) {
              callback(parsed);
              return;
            }
          }
        } catch {}
        callback(this.getAll());
      }
    };

    const handleMongoKvEvent = (e: any) => {
      if (e?.detail?.key === EXPERTISE_STORAGE_KEY) {
        if (Array.isArray(e.detail.value) && e.detail.value.length > 0) {
          callback(e.detail.value);
        } else {
          callback(this.getAll());
        }
      }
    };

    const handleMongoDbEvent = (e: any) => {
      const kvFields = e?.detail?.kv?.[EXPERTISE_STORAGE_KEY];
      if (Array.isArray(kvFields) && kvFields.length > 0) {
        callback(kvFields);
      } else {
        callback(this.getAll());
      }
    };

    const handleFocus = () => {
      this.fetchFromBackend().then(fields => {
        try { callback(fields); } catch {}
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener(EXPERTISE_EVENT_NAME, handleCustomEvent);
      window.addEventListener("storage", handleStorageEvent as EventListener);
      window.addEventListener("mongo_kv_updated", handleMongoKvEvent);
      window.addEventListener("mongo_db_updated", handleMongoDbEvent);
      window.addEventListener("focus", handleFocus);

      // EGRESS FIX: this was a never-ending 1.5 s poll of /api/domains on every page.
      // Domain names change rarely (only when an admin edits them, which also fires the events
      // above), so a 5-minute refresh while the tab is visible is plenty.
      if (!isPollingStarted) {
        isPollingStarted = true;
        startVisibleInterval(() => {
          this.fetchFromBackend();
        }, 5 * 60_000);
      }
    }

    return () => {
      listeners.delete(callback);
      if (typeof window !== "undefined") {
        window.removeEventListener(EXPERTISE_EVENT_NAME, handleCustomEvent);
        window.removeEventListener("storage", handleStorageEvent as EventListener);
        window.removeEventListener("mongo_kv_updated", handleMongoKvEvent);
        window.removeEventListener("mongo_db_updated", handleMongoDbEvent);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }
};
