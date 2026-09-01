/**
 * AUTH ADAPTER — the only surface the UI talks to.
 *
 * The UI never imports Firebase or a backend client directly.
 * `createAuthAdapter()` returns the best adapter for the environment:
 *
 *  - When `NEXT_PUBLIC_API_URL` is set → BackendAuthAdapter, which talks
 *    to the Code Butler API (FastAPI; Firebase-ready — the backend holds
 *    the Firebase Admin SDK connection).
 *  - Otherwise → MemoryAuthAdapter, a local demo that never touches the
 *    network. It reports `configured: false` so the UI can stay honest
 *    about what is real.
 */

export interface User {
  uid: string;
  name: string;
  email: string;
}

export interface AuthAdapter {
  /** true when a real identity backend is reachable */
  readonly configured: boolean;
  signIn(email: string, password: string, remember?: boolean): Promise<User>;
  signUp(name: string, email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  onStateChange(cb: (user: User | null) => void): () => void;
}

const SESSION_KEY = "cb-session";

/* ------------------------------------------------------------------ */
/* Demo adapter — local only, no network, clearly marked unconfigured  */
/* ------------------------------------------------------------------ */

export class MemoryAuthAdapter implements AuthAdapter {
  readonly configured = false;
  private listeners = new Set<(u: User | null) => void>();
  private current: User | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) this.current = JSON.parse(saved);
      } catch {
        /* ignore corrupt session */
      }
    }
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current));
  }

  async signIn(email: string, _password: string, remember = true): Promise<User> {
    await new Promise((r) => setTimeout(r, 500));
    this.current = { uid: "local-user", name: email.split("@")[0] || "User", email };
    if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(this.current));
    this.emit();
    return this.current;
  }

  async signUp(name: string, email: string, _password: string): Promise<User> {
    await new Promise((r) => setTimeout(r, 500));
    this.current = { uid: "local-user", name, email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(this.current));
    this.emit();
    return this.current;
  }

  async signOut(): Promise<void> {
    this.current = null;
    localStorage.removeItem(SESSION_KEY);
    this.emit();
  }

  async resetPassword(_email: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 500));
  }

  onStateChange(cb: (u: User | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.current);
    return () => this.listeners.delete(cb);
  }
}

/* ------------------------------------------------------------------ */
/* Backend adapter — real HTTP to the Code Butler API                  */
/* ------------------------------------------------------------------ */

export class BackendAuthAdapter implements AuthAdapter {
  readonly configured = true;
  private listeners = new Set<(u: User | null) => void>();
  private current: User | null = null;
  private token: string | null = null;
  private readonly base: string;

  constructor(baseUrl?: string) {
    this.base = (baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
      /\/$/,
      ""
    );
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.current = parsed.user ?? null;
          this.token = parsed.token ?? null;
        }
      } catch {
        /* ignore corrupt session */
      }
    }
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current));
  }

  private persist() {
    if (this.current && this.token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: this.current, token: this.token }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}/api/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const d = (body as { detail?: unknown })?.detail;
      const message =
        typeof d === "string"
          ? d
          : (d as { message?: string } | undefined)?.message ?? `Request failed (${res.status})`;
      throw new Error(message);
    }
    return res.json() as Promise<T>;
  }

  async signIn(email: string, password: string, remember = true): Promise<User> {
    const body = await this.request<{ user: User; token: string }>("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.current = body.user;
    this.token = body.token;
    if (remember) this.persist();
    else localStorage.removeItem(SESSION_KEY);
    this.emit();
    return this.current;
  }

  async signUp(name: string, email: string, password: string): Promise<User> {
    const body = await this.request<{ user: User; token: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    this.current = body.user;
    this.token = body.token;
    this.persist();
    this.emit();
    return this.current;
  }

  async signOut(): Promise<void> {
    try {
      await this.request("/auth/signout", { method: "POST" });
    } catch {
      /* token may already be dead — local cleanup is what matters */
    }
    this.current = null;
    this.token = null;
    localStorage.removeItem(SESSION_KEY);
    this.emit();
  }

  async resetPassword(email: string): Promise<void> {
    await this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  onStateChange(cb: (u: User | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.current);
    return () => this.listeners.delete(cb);
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function createAuthAdapter(): AuthAdapter {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return new BackendAuthAdapter();
  }
  return new MemoryAuthAdapter();
}