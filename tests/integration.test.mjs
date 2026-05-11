import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.PMP_TEST_BASE_URL || "";
const username = process.env.PMP_TEST_USERNAME || "admin";
const password = process.env.PMP_TEST_PASSWORD || "";

function shouldRunIntegration() {
  return Boolean(baseUrl && password);
}

async function apiFetch(path, options = {}, cookie = "") {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-app-language": "en",
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return { response, payload };
}

async function signIn() {
  const { response, payload } = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200, payload.error?.message);
  const cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
  assert.ok(cookie, "login should return a session cookie");
  return cookie;
}

test("mailbox creation, group filtering, and random subdomain assignment", { skip: !shouldRunIntegration() }, async () => {
  const cookie = await signIn();
  const stamp = Date.now().toString(36);

  const generated = await apiFetch(
    "/api/subdomains/generate",
    {
      method: "POST",
      body: JSON.stringify({
        count: 1,
        labelLength: 5,
        customLabels: `itest-${stamp}-a\nitest-${stamp}-b`
      })
    },
    cookie
  );
  assert.equal(generated.response.status, 200, generated.payload.error?.message);
  assert.ok(generated.payload.createdCount >= 1);

  const groupCreated = await apiFetch(
    "/api/mailbox-groups",
    {
      method: "POST",
      body: JSON.stringify({ name: `itest-${stamp}`, color: "#156f5b" })
    },
    cookie
  );
  assert.equal(groupCreated.response.status, 201, groupCreated.payload.error?.message);

  const mailboxCreated = await apiFetch(
    "/api/mailboxes",
    {
      method: "POST",
      body: JSON.stringify({
        subdomainId: "",
        localPartMode: "custom",
        localPart: `itest-${stamp}`,
        groupId: groupCreated.payload.group.id,
        note: "integration test"
      })
    },
    cookie
  );
  assert.equal(mailboxCreated.response.status, 201, mailboxCreated.payload.error?.message);
  assert.match(mailboxCreated.payload.mailbox.fullAddress, new RegExp(`^itest-${stamp}@`));

  const mailboxes = await apiFetch("/api/mailboxes", { method: "GET" }, cookie);
  assert.equal(mailboxes.response.status, 200, mailboxes.payload.error?.message);
  const created = mailboxes.payload.items.find((item) => item.id === mailboxCreated.payload.mailbox.id);
  assert.ok(created, "created mailbox should be listed");
  assert.equal(created.groupId, groupCreated.payload.group.id);
});
