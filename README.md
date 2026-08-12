# @tempmailer/sdk

[![npm version](https://img.shields.io/npm/v/@tempmailer/sdk.svg)](https://www.npmjs.com/package/@tempmailer/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@tempmailer/sdk.svg)](https://www.npmjs.com/package/@tempmailer/sdk)
[![CI](https://github.com/tempmailer-io/tempmailer-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/tempmailer-io/tempmailer-sdk/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@tempmailer/sdk.svg)](./LICENSE)

Official TypeScript SDK for the [TempMailer](https://tempmailer.io) Developer API. Create inboxes, receive real email, and **extract the OTP in one call** — built for automated email testing (Playwright, Cypress, CI).

```ts
const client = new Inbox(process.env.TEMPMAILER_API_KEY!);
const inbox = await client.inboxes.create();
// … your app sends a verification email to inbox.address …
const code = await client.otp(inbox.id, { timeout: 30 }); // → "914614"
```

No message to unwrap, no body to parse, no polling loop.

---

## Install

```bash
npm install @tempmailer/sdk
```

Requires **Node 18+** (uses the built-in `fetch`). Get an API key from your [dashboard](https://tempmailer.io/dashboard) → Developer API.

```ts
import { Inbox } from "@tempmailer/sdk";

const client = new Inbox("tm_live_your_key", {
  // Set this to your API host if you're self-hosting or on staging.
  // Defaults to https://tempmailer-backend.onrender.com/v1
  baseUrl: "https://tempmailer-backend.onrender.com/v1",
});
```

---

## Quickstart

```ts
import { Inbox } from "@tempmailer/sdk";

const client = new Inbox(process.env.TEMPMAILER_API_KEY!);

// 1. Create a throwaway inbox (random address)
const inbox = await client.inboxes.create();
console.log(inbox.address); // e.g. a1b2c3d4@quickmailr.store

// 2. Trigger the email in your app (sign up with inbox.address) …

// 3. Wait for the code — the call blocks until it arrives (or times out)
const code = await client.otp(inbox.id, { timeout: 30 });
if (code === null) throw new Error("No verification email arrived");
```

`otp()` returns:
- a **string** (the code) when one is found,
- `{ type: "link", url }` for passwordless / magic-link emails with no code,
- `null` on timeout.

---

## Extracting codes

```ts
const code = await client.otp(inbox.id, {
  since: testStart,            // only messages after this time (Date or ISO string)
  from: "noreply@yourapp.com", // filter by sender (substring, case-insensitive)
  subject: "verify",           // subject contains (case-insensitive)
  timeout: 30,                 // total seconds to wait (default 30)
});
```

On **Ultra / Mega** plans the code is extracted server-side. On **Free / Pro** the SDK extracts it client-side from the message — same `otp()` call either way. The extractor prefers a code sitting next to a keyword ("code", "verification", …), so order numbers, years, and digits inside URLs don't get picked by mistake.

> `since` defaults to the moment you call `otp()`/`wait()`, so a re-run never returns a stale code. For flows where the email may land *before* you call, record a timestamp first and pass it as `since`.

---

## Magic links

```ts
const result = await client.otp(inbox.id, { timeout: 30 });
if (typeof result === "object" && result?.type === "link") {
  await page.goto(result.url);
}
```

Or grab the full message and pick the link yourself — `message.links` is already parsed, with tracking pixels and unsubscribe URLs stripped:

```ts
const message = await client.wait(inbox.id, { since: testStart });
const verifyUrl = message?.links.find((l) => l.includes("/verify"));
```

---

## Persistent (named) inboxes

Most temp-mail tools delete the inbox when your run ends. TempMailer inboxes can be **persistent** — name one and reuse the same address across runs, so you can debug yesterday's CI failure or test a flow that spans days.

```ts
// Same address on every run; the address never expires.
const inbox = await client.inboxes.create({ username: "qa-checkout", persist: true });
// … later, in any run:
const again = await client.inboxes.get("qa-checkout@quickmailr.store");
```

Messages still follow your plan's retention; only the address is permanent.

---

## API

| Method | Description |
| --- | --- |
| `client.inboxes.create(opts?)` | Create an inbox. `{ username?, domain?, persist? }` |
| `client.inboxes.get(idOrAddress)` | Fetch an inbox by id or address |
| `client.inboxes.list()` | List your inboxes |
| `client.inboxes.delete(id)` | Delete an inbox and its messages |
| `client.messages.list(inboxId, opts?)` | List messages `{ since?, limit?, unread? }` → `{ data }` |
| `client.messages.get(id)` | Fetch a full message (bodies + `links`) |
| `client.messages.markRead(id)` | Mark a message read |
| `client.messages.delete(id)` | Delete a message |
| `client.wait(inboxId, opts?)` | Long-poll for the next matching message → `Message \| null` |
| `client.otp(inboxId, opts?)` | Long-poll and return the code / link → `string \| { type:"link", url } \| null` |

Errors throw `TempMailerError` with `.status` and `.code`. `wait()` and `otp()` return `null` on timeout (they don't throw).

---

## Webhooks vs. polling

`wait()` long-polls — ideal for tests. For production event delivery, register a **webhook** (Pro+) and TempMailer pushes `message.received` events to your URL. Both hit the same inbox; use whichever fits.

---

## License

MIT
