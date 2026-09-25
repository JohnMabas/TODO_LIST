const todos = [];
let nextTodoId = 1;

function createTodo({ title, description, completed, userId }) {
  const now = new Date().toISOString();
  const todo = {
    id: nextTodoId,
    title,
    description,
    completed,
    userId: Number(userId),
    createdAt: now,
    updatedAt: now,
  };

  nextTodoId += 1;
  todos.push(todo);
  return todo;
}

function findTodosByUserId(userId, filters = {}) {
  const numericUserId = Number(userId);
  const search = filters.search ? filters.search.toLowerCase() : "";

  return todos
    .filter((todo) => {
      if (todo.userId !== numericUserId) {
        return false;
      }

      if (filters.completed !== undefined && todo.completed !== filters.completed) {
        return false;
      }

      if (
        search &&
        !todo.title.toLowerCase().includes(search) &&
        !todo.description.toLowerCase().includes(search)
      ) {
        return false;
      }

      return true;
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function findTodoForUser(id, userId) {
  const todo = todos.find((item) => item.id === Number(id));
  if (!todo || todo.userId !== Number(userId)) {
    return undefined;
  }

  return todo;
}

function updateTodoForUser(id, userId, updates) {
  const todo = findTodoForUser(id, userId);
  if (!todo) {
    return undefined;
  }

  if (updates.title !== undefined) {
    todo.title = updates.title;
  }

  if (updates.description !== undefined) {
    todo.description = updates.description;
  }

  if (updates.completed !== undefined) {
    todo.completed = updates.completed;
  }

  todo.updatedAt = new Date().toISOString();
  return todo;
}

function deleteTodoForUser(id, userId) {
  const todo = findTodoForUser(id, userId);
  if (!todo) {
    return undefined;
  }

  const index = todos.indexOf(todo);
  todos.splice(index, 1);
  return todo;
}

module.exports = {
  todos,
  createTodo,
  findTodosByUserId,
  findTodoForUser,
  updateTodoForUser,
  deleteTodoForUser,
};
