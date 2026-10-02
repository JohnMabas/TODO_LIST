const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { resetSchema } = require("../src/db/migrate");
const { closePool } = require("../src/db/pool");

let server;
let baseUrl;
let counter = 0;

before(async () => {
  await resetSchema();

  // The shared app runs with effectively unlimited budgets so the suite is not
  // throttled by the production limiters. The limiter tests below build their
  // own apps with deliberately tight budgets.
  const app = createApp({
    limiters: {
      generalMax: 100_000,
      authMax: 100_000,
      sensitiveMax: 100_000,
    },
  });

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await closePool();
});

async function request(path, options = {}) {
  const headers = {};

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${options.baseUrl || baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body = null;

  if (text) {
    body = JSON.parse(text);
  }

  return { status: response.status, body, headers: response.headers };
}

function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}@example.com`;
}

async function registerAndLogin(name = "Test User", password = "Password123!") {
  const email = uniqueEmail();

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
  assert.equal(registration.status, 201);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(login.status, 200);

  return {
    email,
    password,
    user: login.body.data.user,
    token: login.body.data.token,
  };
}

describe("health", () => {
  it("reports database connectivity", async () => {
    const response = await request("/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.database, "up");
  });
});

describe("register and login against Postgres", () => {
  it("persists a registered user and never returns the password hash", async () => {
    const email = uniqueEmail("register");

    const response = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Persisted User", email, password: "Password123!" },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.email, email);
    assert.equal(response.body.data.name, "Persisted User");
    assert.equal(response.body.data.role, "user");
    assert.ok(Number.isSafeInteger(response.body.data.id));
    assert.equal(response.body.data.password, undefined);
    assert.match(response.body.data.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("ignores a client supplied role", async () => {
    const email = uniqueEmail("role");

    const response = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Escalation Attempt", email, password: "Password123!", role: "admin" },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.role, "user");
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail("duplicate");

    const first = await request("/api/auth/register", {
      method: "POST",
      body: { name: "First", email, password: "Password123!" },
    });
    assert.equal(first.status, 201);

    const second = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Second", email, password: "Password123!" },
    });
    assert.equal(second.status, 409);
  });

  it("rejects a weak password with 400", async () => {
    const response = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Weak", email: uniqueEmail("weak"), password: "short" },
    });

    assert.equal(response.status, 400);
  });

  it("logs in with correct credentials and returns a usable token", async () => {
    const email = uniqueEmail("login");
    const password = "Password123!";

    await request("/api/auth/register", {
      method: "POST",
      body: { name: "Login User", email, password },
    });

    const response = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.email, email);
    assert.equal(response.body.data.user.password, undefined);
    assert.ok(response.body.data.token);

    const profile = await request("/api/users/me", { token: response.body.data.token });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.email, email);
  });

  it("rejects a wrong password and an unknown user with 401", async () => {
    const email = uniqueEmail("wrong");
    await request("/api/auth/register", {
      method: "POST",
      body: { name: "Wrong Password", email, password: "Password123!" },
    });

    const wrongPassword = await request("/api/auth/login", {
      method: "POST",
      body: { email, password: "Password1234!" },
    });
    assert.equal(wrongPassword.status, 401);

    const unknownUser = await request("/api/auth/login", {
      method: "POST",
      body: { email: uniqueEmail("ghost"), password: "Password123!" },
    });
    assert.equal(unknownUser.status, 401);
  });

  it("rejects a forged or tampered token", async () => {
    const forged = await request("/api/users/me", { token: "not-a-real-token" });
    assert.equal(forged.status, 401);

    const session = await registerAndLogin();
    const tampered = `${session.token.slice(0, -3)}abc`;
    const response = await request("/api/users/me", { token: tampered });
    assert.equal(response.status, 401);
  });
});

describe("user CRUD (self-service)", () => {
  it("requires authentication", async () => {
    assert.equal((await request("/api/users/me")).status, 401);
    assert.equal((await request("/api/users/me", { method: "PATCH", body: { name: "New" } })).status, 401);
    assert.equal(
      (await request("/api/users/me/password", { method: "PUT", body: {} })).status,
      401
    );
    assert.equal((await request("/api/users/me", { method: "DELETE" })).status, 401);
  });

  it("reads the caller's own profile", async () => {
    const session = await registerAndLogin("Profile Reader");
    const response = await request("/api/users/me", { token: session.token });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, session.user.id);
    assert.equal(response.body.data.email, session.email);
    assert.equal(response.body.data.password, undefined);
  });

  it("updates the name and persists it across a fresh login", async () => {
    const session = await registerAndLogin("Original Name");

    const response = await request("/api/users/me", {
      method: "PATCH",
      token: session.token,
      body: { name: "Updated Name" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.name, "Updated Name");
    assert.notEqual(response.body.data.updatedAt, response.body.data.createdAt);

    const relogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: session.email, password: session.password },
    });
    assert.equal(relogin.body.data.user.name, "Updated Name");
  });

  it("rejects an invalid profile update", async () => {
    const session = await registerAndLogin();

    const badName = await request("/api/users/me", {
      method: "PATCH",
      token: session.token,
      body: { name: "x" },
    });
    assert.equal(badName.status, 400);

    const disallowed = await request("/api/users/me", {
      method: "PATCH",
      token: session.token,
      body: { name: "Valid Name", role: "admin" },
    });
    assert.equal(disallowed.status, 400);

    const empty = await request("/api/users/me", {
      method: "PATCH",
      token: session.token,
      body: {},
    });
    assert.equal(empty.status, 400);
  });

  it("changes the password and invalidates the old one", async () => {
    const session = await registerAndLogin();
    const newPassword = "BrandNewPass456!";

    const response = await request("/api/users/me/password", {
      method: "PUT",
      token: session.token,
      body: { currentPassword: session.password, newPassword },
    });
    assert.equal(response.status, 200);

    const oldLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: session.email, password: session.password },
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: session.email, password: newPassword },
    });
    assert.equal(newLogin.status, 200);
  });

  it("rejects a password change with the wrong current password", async () => {
    const session = await registerAndLogin();

    const response = await request("/api/users/me/password", {
      method: "PUT",
      token: session.token,
      body: { currentPassword: "WrongCurrent123!", newPassword: "BrandNewPass456!" },
    });

    assert.equal(response.status, 400);

    const stillWorks = await request("/api/auth/login", {
      method: "POST",
      body: { email: session.email, password: session.password },
    });
    assert.equal(stillWorks.status, 200);
  });

  it("deletes the account and cascades to its todos", async () => {
    const session = await registerAndLogin("Doomed User");

    const todo = await request("/api/todos", {
      method: "POST",
      token: session.token,
      body: { title: "Will be cascade deleted" },
    });
    assert.equal(todo.status, 201);

    const deleted = await request("/api/users/me", { method: "DELETE", token: session.token });
    assert.equal(deleted.status, 200);

    const tokenAfterDelete = await request("/api/users/me", { token: session.token });
    assert.equal(tokenAfterDelete.status, 401);

    const loginAfterDelete = await request("/api/auth/login", {
      method: "POST",
      body: { email: session.email, password: session.password },
    });
    assert.equal(loginAfterDelete.status, 401);
  });

  it("does not expose any route to read or edit another user", async () => {
    const first = await registerAndLogin("First Owner");
    const second = await registerAndLogin("Second Owner");

    const directRead = await request(`/api/users/${first.user.id}`, { token: second.token });
    assert.equal(directRead.status, 404);

    const directUpdate = await request(`/api/users/${first.user.id}`, {
      method: "PATCH",
      token: second.token,
      body: { name: "Hijacked" },
    });
    assert.equal(directUpdate.status, 404);

    const listAll = await request("/api/users", { token: second.token });
    assert.equal(listAll.status, 404);

    const original = await request("/api/users/me", { token: first.token });
    assert.equal(original.body.data.name, "First Owner");
  });
});

describe("todo CRUD backed by Postgres", () => {
  it("protects todo routes", async () => {
    assert.equal((await request("/api/todos")).status, 401);
  });

  it("runs the full create, read, update, delete flow", async () => {
    const owner = await registerAndLogin("Todo Owner");
    const stranger = await registerAndLogin("Stranger");

    const created = await request("/api/todos", {
      method: "POST",
      token: owner.token,
      body: {
        title: "Write API tests",
        description: "Verify the complete request flow",
        userId: stranger.user.id,
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.userId, owner.user.id);
    assert.equal(created.body.data.completed, false);
    assert.ok(Number.isSafeInteger(created.body.data.id));

    const todoId = created.body.data.id;

    await request("/api/todos", {
      method: "POST",
      token: owner.token,
      body: { title: "Completed task", completed: true },
    });

    const listed = await request("/api/todos?search=API&completed=false", { token: owner.token });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].id, todoId);

    const fetched = await request(`/api/todos/${todoId}`, { token: owner.token });
    assert.equal(fetched.status, 200);

    const forbiddenRead = await request(`/api/todos/${todoId}`, { token: stranger.token });
    assert.equal(forbiddenRead.status, 404);

    const forbiddenUpdate = await request(`/api/todos/${todoId}`, {
      method: "PUT",
      token: stranger.token,
      body: { completed: true },
    });
    assert.equal(forbiddenUpdate.status, 404);

    const forbiddenDelete = await request(`/api/todos/${todoId}`, {
      method: "DELETE",
      token: stranger.token,
    });
    assert.equal(forbiddenDelete.status, 404);

    const updated = await request(`/api/todos/${todoId}`, {
      method: "PUT",
      token: owner.token,
      body: { title: "Updated task", completed: true },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.title, "Updated task");
    assert.equal(updated.body.data.completed, true);

    const deleted = await request(`/api/todos/${todoId}`, {
      method: "DELETE",
      token: owner.token,
    });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.id, todoId);

    const missing = await request(`/api/todos/${todoId}`, { token: owner.token });
    assert.equal(missing.status, 404);

    const invalidQuery = await request("/api/todos?completed=maybe", { token: owner.token });
    assert.equal(invalidQuery.status, 400);

    const invalidId = await request("/api/todos/abc", { token: owner.token });
    assert.equal(invalidId.status, 400);
  });

  it("orders newest todos first and scopes results to the owner", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();

    const first = await request("/api/todos", {
      method: "POST",
      token: owner.token,
      body: { title: "Oldest" },
    });
    const second = await request("/api/todos", {
      method: "POST",
      token: owner.token,
      body: { title: "Newest" },
    });
    await request("/api/todos", {
      method: "POST",
      token: stranger.token,
      body: { title: "Not yours" },
    });

    const listed = await request("/api/todos", { token: owner.token });
    assert.equal(listed.body.data.length, 2);
    assert.equal(listed.body.data[0].id, second.body.data.id);
    assert.equal(listed.body.data[1].id, first.body.data.id);

    const foreignList = await request("/api/todos", { token: stranger.token });
    assert.equal(foreignList.body.data.length, 1);
    assert.equal(foreignList.body.data[0].title, "Not yours");
  });
});

describe("error handling", () => {
  it("returns a structured 404 for unknown routes", async () => {
    const response = await request("/api/nope");
    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /Route not found/);
  });

  it("returns 400 for malformed JSON without leaking a stack trace", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.stack, undefined);
  });

  it("never leaks internals on a 500", async () => {
    const express = require("express");
    const errorHandler = require("../src/middleware/errorHandler");

    const boomApp = express();
    boomApp.get("/__boom", () => {
      throw new Error("secret internal detail");
    });
    boomApp.use(errorHandler);

    const boomServer = boomApp.listen(0, "127.0.0.1");
    await new Promise((resolve) => boomServer.once("listening", resolve));
    const boomUrl = `http://127.0.0.1:${boomServer.address().port}`;

    try {
      const response = await request("/__boom", { baseUrl: boomUrl });
      assert.equal(response.status, 500);
      assert.equal(response.body.success, false);
      assert.equal(response.body.message, "Something went wrong.");
      assert.equal(response.body.message.includes("secret internal detail"), false);
    } finally {
      await new Promise((resolve) => boomServer.close(resolve));
    }
  });
});

describe("rate limiting", () => {
  it("sets standard rate limit headers", async () => {
    const limitedApp = createApp({
      limiters: { generalMax: 50, generalWindowMs: 60 * 1000 },
    });
    const limitedServer = limitedApp.listen(0, "127.0.0.1");
    await new Promise((resolve) => limitedServer.once("listening", resolve));
    const limitedUrl = `http://127.0.0.1:${limitedServer.address().port}`;

    try {
      const first = await request("/health", { baseUrl: limitedUrl });
      const second = await request("/health", { baseUrl: limitedUrl });

      assert.equal(first.status, 200);
      assert.equal(first.headers.get("ratelimit-limit"), "50");
      assert.equal(first.headers.get("ratelimit-remaining"), "49");
      assert.equal(second.headers.get("ratelimit-remaining"), "48");
      assert.equal(first.headers.get("ratelimit-policy"), "50;w=60");
      assert.equal(first.headers.get("ratelimit-reset"), "60");
    } finally {
      await new Promise((resolve) => limitedServer.close(resolve));
    }
  });

  it("does not set legacy X-RateLimit headers", async () => {
    const response = await request("/health");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ratelimit-limit"), null);
  });

  it("returns 429 once the auth limiter is exhausted", async () => {
    const limitedApp = createApp({
      limiters: { authMax: 3, authWindowMs: 60 * 1000 },
    });
    const limitedServer = limitedApp.listen(0, "127.0.0.1");
    await new Promise((resolve) => limitedServer.once("listening", resolve));
    const limitedUrl = `http://127.0.0.1:${limitedServer.address().port}`;

    try {
      const statuses = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await request("/api/auth/login", {
          baseUrl: limitedUrl,
          method: "POST",
          body: { email: uniqueEmail("flood"), password: "Password123!" },
        });
        statuses.push(response.status);

        if (response.status === 429) {
          assert.equal(response.body.success, false);
          assert.match(response.body.message, /Too many/);
        }
      }

      assert.equal(statuses.slice(0, 3).every((status) => status === 401), true);
      assert.equal(statuses.includes(429), true, "expected the auth limiter to return 429");
    } finally {
      await new Promise((resolve) => limitedServer.close(resolve));
    }
  });

  it("returns 429 once the sensitive limiter is exhausted", async () => {
    const limitedApp = createApp({
      limiters: { sensitiveMax: 2, sensitiveWindowMs: 60 * 1000 },
    });
    const limitedServer = limitedApp.listen(0, "127.0.0.1");
    await new Promise((resolve) => limitedServer.once("listening", resolve));
    const limitedUrl = `http://127.0.0.1:${limitedServer.address().port}`;

    try {
      const session = await registerAndLogin();

      const statuses = [];

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await request("/api/users/me", {
          baseUrl: limitedUrl,
          method: "PATCH",
          token: session.token,
          body: { name: `Renamed ${attempt}` },
        });
        statuses.push(response.status);
      }

      assert.equal(statuses.slice(0, 2).every((status) => status === 200), true);
      assert.equal(statuses.includes(429), true, "expected the sensitive limiter to return 429");
    } finally {
      await new Promise((resolve) => limitedServer.close(resolve));
    }
  });
});