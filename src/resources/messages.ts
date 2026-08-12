import type { HttpClient } from "../http.js";
import type { ListMessagesOptions, Message, MessageSummary } from "../types.js";
import { toIso } from "../util.js";

export class Messages {
  constructor(private readonly http: HttpClient) {}

  /** List messages in an inbox, newest first. */
  async list(
    inboxId: string,
    opts: ListMessagesOptions = {},
  ): Promise<{ data: MessageSummary[] }> {
    const r = await this.http.request<{ messages: MessageSummary[] }>(
      `/inboxes/${encodeURIComponent(inboxId)}/messages`,
      { query: { since: toIso(opts.since), limit: opts.limit, unread: opts.unread } },
    );
    return { data: r.messages };
  }

  /** Fetch one full message (bodies + parsed links). */
  async get(id: string): Promise<Message> {
    const r = await this.http.request<{ message: Message }>(
      `/messages/${encodeURIComponent(id)}`,
    );
    return r.message;
  }

  /** Mark a message read. */
  async markRead(id: string): Promise<{ message: Message }> {
    return this.http.request<{ message: Message }>(
      `/messages/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    );
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>(
      `/messages/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }
}
