const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const todoStore = require("../data/todos");
const { validateTodoId } = require("../validators/todoValidator");

exports.create = asyncHandler(async (req, res) => {
  const { title, description, completed } = req.validatedBody;
  const todo = todoStore.createTodo({
    title,
    description,
    completed,
    userId: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Todo created successfully.",
    data: todo,
  });
});

exports.list = asyncHandler(async (req, res) => {
  const todos = todoStore.findTodosByUserId(req.user.id, req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Todos retrieved successfully.",
    data: todos,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const id = validateTodoId(req.params.id);
  const todo = todoStore.findTodoForUser(id, req.user.id);

  if (!todo) {
    throw new AppError("Todo not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Todo retrieved successfully.",
    data: todo,
  });
});

exports.update = asyncHandler(async (req, res) => {
  const id = validateTodoId(req.params.id);
  const todo = todoStore.updateTodoForUser(id, req.user.id, req.validatedBody);

  if (!todo) {
    throw new AppError("Todo not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Todo updated successfully.",
    data: todo,
  });
});

exports.delete = asyncHandler(async (req, res) => {
  const id = validateTodoId(req.params.id);
  const todo = todoStore.deleteTodoForUser(id, req.user.id);

  if (!todo) {
    throw new AppError("Todo not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Todo deleted successfully.",
    data: { id: todo.id },
  });
});
