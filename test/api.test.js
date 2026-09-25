const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options = {}) {
  const headers = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body = null;

  if (text) {
    body = JSON.parse(text);
  }

  return { status: response.status, body };
}

test("authentication and Todo ownership work end to end", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = "Password123!";

  const unauthenticated = await request("/api/todos");
  assert.equal(unauthenticated.status, 401);

  const firstRegistration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "First User",
      email: `first-${suffix}@example.com`,
      password,
      role: "admin",
    },
  });
  assert.equal(firstRegistration.status, 201);
  assert.equal(firstRegistration.body.success, true);
  assert.equal(firstRegistration.body.data.password, undefined);
  assert.equal(firstRegistration.body.data.role, "user");

  const secondRegistration = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: `second-${suffix}@example.com`,
      password,
    },
  });
  assert.equal(secondRegistration.status, 201);

  const firstLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: `first-${suffix}@example.com`, password },
  });
  assert.equal(firstLogin.status, 200);
  assert.ok(firstLogin.body.data.token);

  const secondLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: `second-${suffix}@example.com`, password },
  });
  assert.equal(secondLogin.status, 200);

  const firstToken = firstLogin.body.data.token;
  const secondToken = secondLogin.body.data.token;
  const firstUserId = firstLogin.body.data.user.id;

  const created = await request("/api/todos", {
    method: "POST",
    token: firstToken,
    body: {
      title: "Write API tests",
      description: "Verify the complete request flow",
      userId: secondLogin.body.data.user.id,
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.userId, firstUserId);
  assert.equal(created.body.data.completed, false);

  const todoId = created.body.data.id;
  const secondTodo = await request("/api/todos", {
    method: "POST",
    token: firstToken,
    body: { title: "Completed task", completed: true },
  });
  assert.equal(secondTodo.status, 201);

  const listed = await request("/api/todos?search=API&completed=false", {
    token: firstToken,
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  assert.equal(listed.body.data[0].id, todoId);

  const fetched = await request(`/api/todos/${todoId}`, { token: firstToken });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.id, todoId);

  const forbiddenRead = await request(`/api/todos/${todoId}`, { token: secondToken });
  assert.equal(forbiddenRead.status, 404);

  const forbiddenUpdate = await request(`/api/todos/${todoId}`, {
    method: "PUT",
    token: secondToken,
    body: { completed: true },
  });
  assert.equal(forbiddenUpdate.status, 404);

  const forbiddenDelete = await request(`/api/todos/${todoId}`, {
    method: "DELETE",
    token: secondToken,
  });
  assert.equal(forbiddenDelete.status, 404);

  const updated = await request(`/api/todos/${todoId}`, {
    method: "PUT",
    token: firstToken,
    body: { title: "Updated task", completed: true },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, "Updated task");
  assert.equal(updated.body.data.completed, true);

  const invalidQuery = await request("/api/todos?completed=maybe", { token: firstToken });
  assert.equal(invalidQuery.status, 400);

  const deleted = await request(`/api/todos/${todoId}`, {
    method: "DELETE",
    token: firstToken,
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data.id, todoId);

  const missing = await request(`/api/todos/${todoId}`, { token: firstToken });
  assert.equal(missing.status, 404);

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    body: { email: `first-${suffix}@example.com`, password },
  });
  assert.equal(duplicate.status, 409);
});
