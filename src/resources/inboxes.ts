import type { HttpClient } from "../http.js";
import type { CreateInboxOptions, InboxResource } from "../types.js";

export class Inboxes {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultDomain?: string,
  ) {}

  /** Create an inbox — random by default, or a fixed `username` / `persist`ent one. */
  async create(opts: CreateInboxOptions = {}): Promise<InboxResource> {
    const r = await this.http.request<{ inbox: InboxResource }>("/inboxes", {
      method: "POST",
      body: {
        username: opts.username,
        domain: opts.domain ?? this.defaultDomain,
        persist: opts.persist,
      },
    });
    return r.inbox;
  }

  /** Fetch one inbox by id or by full address (e.g. `qa@yourdomain.com`). */
  async get(idOrAddress: string): Promise<InboxResource> {
    const r = await this.http.request<{ inbox: InboxResource }>(
      `/inboxes/${encodeURIComponent(idOrAddress)}`,
    );
    return r.inbox;
  }

  async list(): Promise<InboxResource[]> {
    const r = await this.http.request<{ inboxes: InboxResource[] }>("/inboxes");
    return r.inboxes;
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>(
      `/inboxes/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }
}
