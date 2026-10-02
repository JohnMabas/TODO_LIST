const { query } = require("../db/pool");

const SELECT_COLUMNS = "id, name, email, password, role, created_at, updated_at";

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...publicUser } = user;
  return publicUser;
}

function toUserWithPassword(row) {
  if (!row) {
    return null;
  }

  return {
    ...mapRow(row),
    password: row.password,
  };
}

async function createUser({ name, email, password, role = "user" }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [name, email, password, role]
  );

  return toUserWithPassword(rows[0]);
}

async function findUserByEmail(email) {
  const { rows } = await query(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [email]);
  return toUserWithPassword(rows[0]);
}

async function findUserById(id) {
  const { rows } = await query(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
  return toUserWithPassword(rows[0]);
}

const UPDATABLE_COLUMNS = new Set(["name", "password"]);

async function updateUserById(id, updates) {
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

  assignments.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE users SET ${assignments.join(", ")}
     WHERE id = $${placeholderIndex}
     RETURNING ${SELECT_COLUMNS}`,
    values
  );

  return mapRow(rows[0]);
}

async function deleteUserById(id) {
  const { rowCount } = await query("DELETE FROM users WHERE id = $1", [id]);
  return rowCount === 1;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserById,
  deleteUserById,
  toPublicUser,
};