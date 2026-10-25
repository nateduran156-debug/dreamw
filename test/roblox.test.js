import test from "node:test";
import assert from "node:assert/strict";
import { stripTag, getRobloxAvatarUrl } from "../src/roblox.js";

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test("stripTag unassigns only the selected tag role", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/usernames/users")) {
      return jsonResponse({ data: [{ id: 12345, name: "RobloxTester" }] });
    }
    if (String(url).includes("/memberships?")) {
      return jsonResponse({
        groupMemberships: [{ path: "groups/1103375761/memberships/9876" }],
      });
    }
    if (String(url).endsWith("/roles")) {
      return jsonResponse({
        roles: [{ id: "role-6", rank: 6 }],
      });
    }
    if (String(url).includes(":unassignRole")) {
      return jsonResponse({ path: "groups/1103375761/memberships/9876" });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await stripTag("RobloxTester", "dream", "test-api-key");

  assert.deepEqual(result, { username: "RobloxTester", userId: 12345, rank: 6 });
  const action = requests.find((request) => request.url.includes(":unassignRole"));
  assert.ok(action);
  assert.equal(action.options.method, "POST");
  assert.deepEqual(JSON.parse(action.options.body), {
    role: "groups/1103375761/roles/role-6",
  });
  assert.equal(requests.some((request) => request.url.includes(":assignRole")), false);
});

test("circular Roblox headshot URL is used when available", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({
      data: [{ targetId: 12345, imageUrl: "https://images.example/avatar.png" }],
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.equal(
    await getRobloxAvatarUrl(12345),
    "https://images.example/avatar.png",
  );
  assert.match(requestedUrl, /isCircular=true/);
  assert.match(requestedUrl, /avatar-headshot/);
});
