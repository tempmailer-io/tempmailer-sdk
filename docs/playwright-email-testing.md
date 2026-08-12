# Playwright email testing

Test the real "verify your email" step in Playwright: create an inbox, receive the actual verification email, extract the code, and finish the flow — locally and in CI. This replaces the two usual hacks (a shared Gmail + app password, or a flaky IMAP poller).

Examples are TypeScript and assume Playwright 1.40+. They work the same in JavaScript — drop the type annotations.

## Install

```bash
npm install -D @tempmailer/sdk
```

Put your key in `.env` (get one from your [dashboard](https://tempmailer.io/dashboard) → Developer API):

```bash
TEMPMAILER_API_KEY=tm_live_your_key_here
```

Give email flows a longer timeout in `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";
import "dotenv/config";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000, // email flows need more than the 30s default
  use: { baseURL: process.env.APP_URL ?? "http://localhost:3000" },
});
```

## Your first test

A complete, working file. Copy it, change the selectors, run it.

```ts
// tests/signup.spec.ts
import { test, expect } from "@playwright/test";
import { Inbox } from "@tempmailer/sdk";

const client = new Inbox(process.env.TEMPMAILER_API_KEY!);

test("user can sign up and verify their email", async ({ page }) => {
  const testStart = new Date(); // so we never pick up a previous run's email

  const inbox = await client.inboxes.create();

  await page.goto("/signup");
  await page.fill("#email", inbox.address);
  await page.fill("#password", "correct-horse-battery-staple");
  await page.click("button[type=submit]");

  await expect(page.getByText("Check your email")).toBeVisible();

  // Blocks until the message lands, then returns the code directly.
  const code = await client.otp(inbox.id, { since: testStart, timeout: 30 });
  expect(code, "no verification email arrived in 30s").not.toBeNull();

  await page.fill("#verification-code", String(code));
  await page.click("#verify");
  await expect(page).toHaveURL("/welcome");
});
```

Three things worth knowing:

- **`client.otp()` returns the code directly** — no message object to unwrap, no regex.
- **`since: testStart`** stops a re-run from matching the *previous* run's email (a green-but-wrong test). If you omit it, `since` defaults to the moment `otp()` is called.
- **`timeout` is a server long-poll.** The connection is held open and returns the instant the email arrives — no polling loop, no `waitForTimeout()` guessing.

## When there's no email

`otp()` returns `null` on timeout instead of throwing, so you can assert on it:

```ts
const code = await client.otp(inbox.id, { since: testStart, timeout: 30 });
expect(code, "no verification email arrived").not.toBeNull();
```

## Magic links

Passwordless flows send a URL. `otp()` returns `{ type: "link", url }` when there's no code:

```ts
const result = await client.otp(inbox.id, { since: testStart, timeout: 30 });
if (typeof result === "object" && result?.type === "link") {
  await page.goto(result.url);
  await expect(page.getByText("Signed in")).toBeVisible();
}
```

Or pick the link yourself from the parsed `links` array (tracking/unsubscribe stripped):

```ts
const message = await client.wait(inbox.id, { since: testStart });
const url = message?.links.find((l) => l.includes("/verify"));
```

## Persistent inboxes as fixtures

Inboxes can be **named and reused across runs** — so you can debug a failure days later or test a flow that spans runs. A Playwright fixture that gives each test a fresh throwaway inbox, plus a helper for stable named ones:

```ts
// tests/fixtures.ts
import { test as base } from "@playwright/test";
import { Inbox, type InboxResource } from "@tempmailer/sdk";

const client = new Inbox(process.env.TEMPMAILER_API_KEY!);

type Fixtures = {
  inbox: InboxResource; // fresh per test
  namedInbox: (name: string) => Promise<InboxResource>; // stable across runs
};

export const test = base.extend<Fixtures>({
  inbox: async ({}, use) => {
    const inbox = await client.inboxes.create();
    await use(inbox);
    await client.inboxes.delete(inbox.id);
  },
  namedInbox: async ({}, use) => {
    await use(async (name: string) => {
      try {
        return await client.inboxes.get(`${name}@${process.env.TEMPMAILER_DOMAIN}`);
      } catch {
        return await client.inboxes.create({ username: name, persist: true });
      }
    });
  },
});

export { expect } from "@playwright/test";
export { client };
```

```ts
import { test, expect, client } from "./fixtures";

test("checkout sends an order confirmation", async ({ page, namedInbox }) => {
  const inbox = await namedInbox("qa-checkout");
  const testStart = new Date();

  await page.goto("/checkout");
  await page.fill("#email", inbox.address);
  await page.click("#place-order");

  const message = await client.wait(inbox.id, {
    since: testStart,
    subject: "order confirmation",
    timeout: 45,
  });
  expect(message?.subject).toContain("Order confirmed");
});
```

## Running in CI (GitHub Actions)

```yaml
name: E2E
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          TEMPMAILER_API_KEY: ${{ secrets.TEMPMAILER_API_KEY }}
          TEMPMAILER_DOMAIN: ${{ vars.TEMPMAILER_DOMAIN }}
          APP_URL: ${{ vars.APP_URL }}
```

**One rule for parallel runs:** give every test its own inbox, or its own `since`. Two tests sharing an address without a `since` boundary will read each other's mail. The `inbox` fixture above handles this automatically.

## Troubleshooting

- **Times out waiting for the email.** Check your app actually sent it (your logs first), that `since` isn't after the message arrived, and that `from`/`subject` aren't excluding it. Drop the filters and call `client.messages.list(inbox.id)` to see what landed.
- **Wrong code extracted.** Add `from` and `subject` filters. On Free/Pro the SDK extracts client-side; on Ultra/Mega it's server-side.
- **Flaky only in CI.** Almost always parallelism — two tests sharing an inbox or a missing `since`. Give each test its own inbox.

## Notes on plans

- **OTP auto-extraction:** server-side on **Ultra/Mega**; the SDK extracts client-side on **Free/Pro** — the `otp()` call is identical.
- **Webhooks** (real-time push instead of polling) are **Pro+**.
- The inbox **address never expires** with `persist: true`; messages follow your plan's retention.
