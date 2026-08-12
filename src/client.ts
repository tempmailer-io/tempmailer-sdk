import { HttpClient } from "./http.js";
import { Inboxes } from "./resources/inboxes.js";
import { Messages } from "./resources/messages.js";
import { extractCode } from "./otp.js";
import { toIso, pickLink } from "./util.js";
import type { ClientOptions, Message, OtpResult, WaitOptions } from "./types.js";

const DEFAULT_BASE = "https://tempmailer-backend.onrender.com/v1";
/** Seconds the server holds a single long-poll before returning 204. */
const SERVER_MAX_WAIT = 60;

/**
 * TempMailer client.
 *
 * ```ts
 * const client = new Inbox(process.env.TEMPMAILER_API_KEY!);
 * const inbox = await client.inboxes.create();
 * const code = await client.otp(inbox.id, { timeout: 30 });
 * ```
 */
export class Inbox {
  readonly inboxes: Inboxes;
  readonly messages: Messages;
  private readonly http: HttpClient;

  constructor(apiKey: string, opts: ClientOptions = {}) {
    if (!apiKey) {
      throw new Error(
        "A TempMailer API key is required. Create one in your dashboard.",
      );
    }
    const baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
    this.http = new HttpClient(apiKey, baseUrl, opts.timeoutMs ?? 30_000);
    this.inboxes = new Inboxes(this.http, opts.domain);
    this.messages = new Messages(this.http);
  }

  /**
   * Long-poll for the next message in an inbox. Returns the full message the
   * instant it arrives, or `null` on timeout. `timeout` is total seconds
   * (default 30); values above the server's 60s hold are continued in segments.
   */
  async wait(inboxId: string, opts: WaitOptions = {}): Promise<Message | null> {
    // Pin `since` once so multi-segment waits never advance past a message.
    const since = toIso(opts.since) ?? new Date().toISOString();
    const deadline = Date.now() + (opts.timeout ?? 30) * 1000;

    for (;;) {
      const remainingSec = Math.ceil((deadline - Date.now()) / 1000);
      if (remainingSec <= 0) return null;
      const segment = Math.min(remainingSec, SERVER_MAX_WAIT);

      const res = await this.http.request<{ message: Message } | undefined>(
        `/inboxes/${encodeURIComponent(inboxId)}/messages/wait`,
        {
          query: { since, from: opts.from, subject: opts.subject, timeout: segment },
          // Give the held connection headroom over the server's own timeout.
          timeoutMs: (segment + 10) * 1000,
        },
      );

      if (res && res.message) return res.message;
      // 204 → no match yet; loop until the overall deadline.
    }
  }

  /**
   * Long-poll and return the verification code directly. Uses the server-
   * extracted code when present (Ultra+), otherwise extracts client-side.
   * Falls back to a magic link when there's no code, or `null` on timeout.
   */
  async otp(inboxId: string, opts: WaitOptions = {}): Promise<OtpResult> {
    const message = await this.wait(inboxId, opts);
    if (!message) return null;

    const code =
      message.otp ??
      extractCode(message.subject, message.bodyText || message.bodyHtml || "");
    if (code) return code;

    const link = pickLink(message.links);
    if (link) return { type: "link", url: link };

    return null;
  }
}
