const { query } = require("../db/pool");

const SELECT_COLUMNS = "id, title, description, completed, user_id, created_at, updated_at";

function toTodo(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    completed: row.completed,
    userId: Number(row.user_id),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function createTodo({ title, description, completed, userId }) {
  const { rows } = await query(
    `INSERT INTO todos (title, description, completed, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [title, description, completed, userId]
  );

  return toTodo(rows[0]);
}

async function findTodosByUserId(userId, filters = {}) {
  const conditions = ["user_id = $1"];
  const values = [userId];
  let placeholderIndex = 2;

  if (filters.completed !== undefined) {
    conditions.push(`completed = $${placeholderIndex}`);
    values.push(filters.completed);
    placeholderIndex += 1;
  }

  if (filters.search) {
    conditions.push(
      `(title ILIKE $${placeholderIndex} ESCAPE '\\' OR description ILIKE $${placeholderIndex} ESCAPE '\\')`
    );
    values.push(`%${escapeLikePattern(filters.search)}%`);
    placeholderIndex += 1;
  }

  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM todos
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC, id DESC`,
    values
  );

  return rows.map(toTodo);
}

async function findTodoForUser(id, userId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM todos WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return toTodo(rows[0]);
}

const UPDATABLE_COLUMNS = new Set(["title", "description", "completed"]);

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

async function updateTodoForUser(id, userId, updates) {
  const assignments = [];
  const values = [];
  let placeholderIndex = 1;

  for (const [column, value] of Object.entries(updates)) {
    if (!UPDATABLE_COLUMNS.has(column)) {
      throw new Error(`Column "${column}" is not updatable.`);
    }

    assignments.push(`${column} = $${placeholderIndex}`);
    values.push(value);
    placeholderIndex += 1;
  }

  assignments.push("updated_at = NOW()");
  values.push(id, userId);

  const { rows } = await query(
    `UPDATE todos SET ${assignments.join(", ")}
     WHERE id = $${placeholderIndex} AND user_id = $${placeholderIndex + 1}
     RETURNING ${SELECT_COLUMNS}`,
    values
  );

  return toTodo(rows[0]);
}

async function deleteTodoForUser(id, userId) {
  const { rows } = await query("DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id", [
    id,
    userId,
  ]);

  return rows.length === 1 ? { id: Number(rows[0].id) } : null;
}

module.exports = {
  createTodo,
  findTodosByUserId,
  findTodoForUser,
  updateTodoForUser,
  deleteTodoForUser,
};