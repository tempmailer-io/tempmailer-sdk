/** Options for constructing the client. */
export interface ClientOptions {
  /**
   * API base URL, including the version path. Defaults to
   * `https://api.tempmailer.io/v1`. Override for staging or self-hosting.
   */
  baseUrl?: string;
  /** Default domain for created inboxes. If omitted, the API picks one. */
  domain?: string;
  /** Per-request timeout in ms for normal calls (not long-polls). Default 30000. */
  timeoutMs?: number;
}

export interface CreateInboxOptions {
  /** Fixed local part (3–30 alphanumeric). Omit for a random address. */
  username?: string;
  /** Domain for this inbox; falls back to the client default, then the API's. */
  domain?: string;
  /** When true, the inbox address never expires — a reusable named fixture. */
  persist?: boolean;
}

export interface InboxResource {
  id: string;
  address: string;
  username: string;
  domain: string;
  createdAt: string;
  /** null when the inbox is persistent. */
  expiresAt: string | null;
}

/** A message as returned by the list endpoint (preview only, no bodies). */
export interface MessageSummary {
  id: string;
  inbox: string;
  from: string;
  fromName: string | null;
  subject: string | null;
  /** Server-extracted one-time code (Ultra+ plans), else null. */
  otp: string | null;
  isRead: boolean;
  receivedAt: string;
  expiresAt: string;
  preview: string;
  hasHtml: boolean;
}

/** A full message, including bodies and parsed links. */
export interface Message {
  id: string;
  inbox: string;
  from: string;
  fromName: string | null;
  subject: string | null;
  otp: string | null;
  isRead: boolean;
  receivedAt: string;
  expiresAt: string;
  bodyText: string;
  bodyHtml: string | null;
  /** Action links parsed from the body (tracking/unsubscribe stripped). */
  links: string[];
}

export interface ListMessagesOptions {
  /** Only messages received after this time (ISO string or Date). */
  since?: string | Date;
  /** 1–100, default 50. */
  limit?: number;
  /** Only unread messages. */
  unread?: boolean;
}

export interface WaitOptions {
  /**
   * Only match messages received after this time. Defaults to the moment
   * `wait()`/`otp()` is called, so a re-run never returns a stale message.
   */
  since?: string | Date;
  /** Only from this sender (substring, case-insensitive). */
  from?: string;
  /** Subject contains (case-insensitive). */
  subject?: string;
  /** Total seconds to wait. Default 30. Values above 60 are polled in segments. */
  timeout?: number;
}

/** A code string, a magic link, or null on timeout. */
export type OtpResult = string | { type: "link"; url: string } | null;
