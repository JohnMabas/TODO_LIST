const users = [];
let nextUserId = 1;

function createUser({ name, email, password, role = "user" }) {
  const user = {
    id: nextUserId,
    name,
    email,
    password,
    role,
    createdAt: new Date().toISOString(),
  };

  nextUserId += 1;
  users.push(user);
  return user;
}

function findUserByEmail(email) {
  return users.find((user) => user.email === email);
}

function findUserById(id) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId)) {
    return undefined;
  }

  return users.find((user) => user.id === numericId);
}

module.exports = {
  users,
  createUser,
  findUserByEmail,
  findUserById,
};
