import { TempMailerError } from "./errors.js";

export interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Per-call timeout override in ms (e.g. long-polls need a longer one). */
  timeoutMs?: number;
}

/** Minimal fetch-based HTTP client. Zero runtime dependencies (Node 18+). */
export class HttpClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly defaultTimeoutMs: number,
  ) {}

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? this.defaultTimeoutMs,
    );

    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "tempmailer-sdk",
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new TempMailerError(
        0,
        aborted ? "timeout" : "network_error",
        aborted ? "Request timed out." : (err instanceof Error ? err.message : "Network error"),
      );
    } finally {
      clearTimeout(timer);
    }

    // 204 No Content (e.g. a long-poll that timed out with no match).
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* non-JSON body */
      }
    }

    if (!res.ok) {
      const e = (data as { error?: { code?: string; message?: string } })?.error;
      throw new TempMailerError(
        res.status,
        e?.code ?? "http_error",
        e?.message ?? `Request failed with status ${res.status}.`,
      );
    }

    return data as T;
  }
}
