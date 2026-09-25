# Todo REST API

A focused Todo REST API built with Node.js and Express.js. It includes JWT authentication, bcrypt password hashing, ownership checks, input validation, rate limiting, request logging, search, completion filtering, and centralized error responses.

## Requirements

- Node.js 18 or newer
- npm 9 or newer

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate a strong JWT secret and put it in `.env`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Start the server:

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
| `NODE_ENV` | No | Runtime environment; defaults to `development` |

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

## Authentication

### Register

`POST /api/auth/register`

`name` is optional and defaults to `User`. `email` and `password` are required. Passwords must be 8–128 characters.

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Example User","email":"user@example.com","password":"Password123!"}'
```

The response contains the public user data. Passwords are never returned.

### Login

`POST /api/auth/login`

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

The response contains a signed JWT in `data.token` and the public user in `data.user`.

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

`GET /api/todos` returns only the authenticated user's Todos. `search` matches title or description without case sensitivity. `completed` accepts `true` or `false`.

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

## Postman or Thunder Client

Import `todo-api.http` into Thunder Client, or create equivalent requests in Postman. Set these variables before sending the collection:

- `baseUrl`: `http://localhost:5000`
- `token`: the token returned by login
- `todoId`: the ID returned by Todo creation

## Tests

Run the end-to-end API test with:

```bash
npm test
```

The test covers registration, login, JWT protection, CRUD operations, search/filtering, validation, and cross-user access denial.

## Project structure

```text
src/
  config/       Environment configuration
  controllers/  HTTP request handlers
  data/         In-memory user and Todo stores
  middleware/   Authentication, validation, logging, limits, errors
  routes/       Route definitions
  utils/        Shared error and async helpers
  validators/   Request validation
test/           Node test runner API tests
```

Data is intentionally stored in memory for this standalone assignment and resets whenever the process restarts. Use a database-backed store for production persistence.
# TODO_LIST
