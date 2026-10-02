# Todo REST API

A Todo REST API built with Node.js, Express.js, and PostgreSQL. It includes JWT authentication, bcrypt password hashing, self-service user management, todo ownership checks, input validation, rate limiting, request logging, search, completion filtering, and centralized error responses.

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- PostgreSQL 12 or newer

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database:

   ```bash
   createdb todo_api
   ```

   Or as an administrator:

   ```bash
   sudo -u postgres createdb todo_api
   ```

3. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

4. Fill in your database credentials and a strong JWT secret in `.env`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Create the tables:

   ```bash
   npm run migrate
   ```

6. Start the server:

   ```bash
   npm start
   ```

   For automatic restarts during development:

   ```bash
   npm run dev
   ```

The server listens on `http://localhost:5000` by default. The included `.env` is ignored by Git; `.env.example` is safe to share.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `5000` |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters |
| `JWT_EXPIRES_IN` | No | JWT lifetime; defaults to `1h` |
| `NODE_ENV` | No | `development`, `production`, or `test`; defaults to `development` |
| `LOG_LEVEL` | No | `error`, `warn`, `info`, or `debug`; defaults to `info` |
| `DATABASE_URL` | Yes* | Full Postgres connection string; takes priority when set |
| `PGUSER` | Yes* | Database role |
| `PGPASSWORD` | No | Database role password |
| `PGDATABASE` | Yes* | Database name |
| `PGHOST` | No | Defaults to `127.0.0.1` |
| `PGPORT` | No | Defaults to `5432` |
| `PGPOOL_MAX` | No | Maximum pooled connections; defaults to `10` |
| `PGSSL` | No | Set to `true` to require TLS (needed by most hosted providers) |

\* Set either `DATABASE_URL`, or both `PGUSER` and `PGDATABASE`.

## API conventions

All successful responses use this shape:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

Errors use this shape:

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

Authenticated requests must include `Authorization: Bearer <token>`.

## Health

`GET /health` reports database connectivity:

```json
{
  "success": true,
  "message": "API is running.",
  "data": { "database": "up" }
}
```

## Authentication

### Register

`POST /api/auth/register`

`name` is optional and defaults to `User`. `email` and `password` are required. Passwords must be 8–128 characters. The server always assigns `role: "user"`, so a client cannot register itself as an admin.

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Example User","email":"user@example.com","password":"Password123!"}'
```

The response contains the public user data. Passwords are never returned. Registering an existing email returns `409`.

### Login

`POST /api/auth/login`

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

The response contains a signed JWT in `data.token` and the public user in `data.user`. Tokens are valid for `JWT_EXPIRES_IN`, and the user is re-read from the database on every request, so deleting an account immediately invalidates its tokens.

## User endpoints

Users can only manage their own account. There is no route to read or edit another user, so no authorization escalation surface is exposed.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/users/me` | Read the caller's profile |
| `PATCH` | `/api/users/me` | Update the caller's name |
| `PUT` | `/api/users/me/password` | Change the caller's password |
| `DELETE` | `/api/users/me` | Delete the account and its todos |

### Read and update the profile

```bash
curl http://localhost:5000/api/users/me \
  -H "Authorization: Bearer $TOKEN"

curl -X PATCH http://localhost:5000/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'
```

Only `name` can be updated. Sending any other field, including `role`, returns `400`.

### Change the password

The current password must be supplied. On success the old password stops working immediately.

```bash
curl -X PUT http://localhost:5000/api/users/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"Password123!","newPassword":"NewPassword456!"}'
```

### Delete the account

Deleting a user cascades to their todos through a foreign key constraint, so no orphaned rows are left behind. Tokens stop working immediately.

```bash
curl -X DELETE http://localhost:5000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

## Todo endpoints

Every endpoint below requires a valid JWT.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/todos` | Create a Todo |
| `GET` | `/api/todos` | List the current user's Todos |
| `GET` | `/api/todos/:id` | Get one owned Todo |
| `PUT` | `/api/todos/:id` | Update an owned Todo |
| `DELETE` | `/api/todos/:id` | Delete an owned Todo |

A Todo contains `id`, `title`, `description`, `completed`, `userId`, `createdAt`, and `updatedAt`. The server always takes `userId` from the authenticated token, so clients cannot assign ownership.

### Create

```bash
curl -X POST http://localhost:5000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Express","description":"Complete the assignment","completed":false}'
```

### List, search, and filter

`GET /api/todos` returns only the authenticated user's Todos, newest first. `search` matches title or description without case sensitivity; `%` and `_` are matched literally. `completed` accepts `true` or `false`.

```bash
curl "http://localhost:5000/api/todos?search=express&completed=false" \
  -H "Authorization: Bearer $TOKEN"
```

### Get, update, and delete

```bash
curl http://localhost:5000/api/todos/1 \
  -H "Authorization: Bearer $TOKEN"

curl -X PUT http://localhost:5000/api/todos/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated title","completed":true}'

curl -X DELETE http://localhost:5000/api/todos/1 \
  -H "Authorization: Bearer $TOKEN"
```

A request for another user's Todo returns `404` rather than revealing that the Todo exists. Invalid IDs and request data return `400`; missing or invalid authentication returns `401`; duplicate registration returns `409`; rate limits return `429`.

## Rate limiting

Three limiters are applied, each returning standard `RateLimit-*` headers and a `429` response when exceeded.

| Scope | Limit |
| --- | --- |
| All routes | 100 requests per 15 minutes |
| `/api/auth/*` | 10 requests per 15 minutes |
| `PATCH /api/users/me`, `PUT /api/users/me/password` | 20 requests per 15 minutes |

Authenticated routes are keyed by IP address.

## Logging

Every request is logged with method, path, status, duration, and client IP. `LOG_LEVEL` controls verbosity; `error`, `warn`, `info`, and `debug` are supported, and only 5xx errors log their stack trace.

## Postman or Thunder Client

Import `todo-api.http` into Thunder Client, or create equivalent requests in Postman. Set these variables before sending the collection:

- `baseUrl`: `http://localhost:5000`
- `token`: the token returned by login
- `todoId`: the ID returned by Todo creation

## Tests

The suite runs against a real PostgreSQL database and resets the `users` and `todos` tables when it starts, so point `PGDATABASE` at a throwaway database, not one holding real data.

```bash
npm test
```

It covers registration, login, duplicate email rejection, weak passwords, wrong passwords, tampered tokens, profile read and update, password rotation, account deletion with cascade, cross-user access denial, the full todo CRUD flow, ordering, `400`/`404`/`500` error shapes, and `429` responses from every limiter.

## Project structure

```text
src/
  config/       Environment and database configuration
  controllers/  HTTP request handlers
  db/           Connection pool, schema, and migrations
  middleware/   Authentication, validation, logging, limits, errors
  repositories/ Parameterized SQL data access
  routes/       Route definitions
  utils/        Shared error and async helpers
  validators/   Request validation
test/           Node test runner API tests
```

All database access uses parameterized queries, and each repository whitelists the columns it will update, so request data can never alter the SQL structure.