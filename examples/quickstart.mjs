// Minimal end-to-end example. Run with:
//   TEMPMAILER_API_KEY=tm_live_... node examples/quickstart.mjs
//
// It creates an inbox, prints the address, then waits up to 60s for the first
// email and prints the extracted code (or magic link).
import { Inbox } from "@tempmailer/sdk";

const key = process.env.TEMPMAILER_API_KEY;
if (!key) {
  console.error("Set TEMPMAILER_API_KEY first.");
  process.exit(1);
}

const client = new Inbox(key, {
  baseUrl: process.env.TEMPMAILER_BASE_URL, // optional override
});

const inbox = await client.inboxes.create();
console.log("Inbox ready:", inbox.address);
console.log("Send an email to that address now — waiting up to 60s…");

const result = await client.otp(inbox.id, { timeout: 60 });

if (result === null) {
  console.log("No email arrived in time.");
} else if (typeof result === "string") {
  console.log("Extracted code:", result);
} else {
  console.log("Magic link:", result.url);
}
