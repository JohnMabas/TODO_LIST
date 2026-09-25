const AppError = require("../utils/AppError");

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const SEARCH_MAX = 200;

function requireObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be a JSON object.", 400);
  }
}

function requireTitle(body) {
  if (typeof body.title !== "string") {
    throw new AppError("title must be a string.", 400);
  }

  const title = body.title.trim();
  if (title.length === 0 || title.length > TITLE_MAX) {
    throw new AppError(`title must be between 1 and ${TITLE_MAX} characters.`, 400);
  }

  return title;
}

function optionalDescription(body) {
  if (body.description === undefined) {
    return "";
  }

  if (typeof body.description !== "string") {
    throw new AppError("description must be a string.", 400);
  }

  const description = body.description.trim();
  if (description.length > DESCRIPTION_MAX) {
    throw new AppError(`description must be at most ${DESCRIPTION_MAX} characters.`, 400);
  }

  return description;
}

function optionalCompleted(body, defaultValue) {
  if (body.completed === undefined) {
    return defaultValue;
  }

  if (typeof body.completed !== "boolean") {
    throw new AppError("completed must be a boolean.", 400);
  }

  return body.completed;
}

function validateCreateTodo(body) {
  requireObject(body);

  return {
    title: requireTitle(body),
    description: optionalDescription(body),
    completed: optionalCompleted(body, false),
  };
}

function validateUpdateTodo(body) {
  requireObject(body);

  const updates = {};
  const allowedFields = ["title", "description", "completed"];

  if (!allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    throw new AppError("At least one of title, description, or completed is required.", 400);
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    updates.title = requireTitle(body);
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = optionalDescription(body);
  }

  if (Object.prototype.hasOwnProperty.call(body, "completed")) {
    updates.completed = optionalCompleted(body, undefined);
  }

  return updates;
}

function validateTodoQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new AppError("Query parameters must be valid.", 400);
  }

  const filters = {};

  if (query.search !== undefined) {
    if (typeof query.search !== "string") {
      throw new AppError("search must be a string.", 400);
    }

    const search = query.search.trim();
    if (search.length > SEARCH_MAX) {
      throw new AppError(`search must be at most ${SEARCH_MAX} characters.`, 400);
    }
    filters.search = search || undefined;
  }

  if (query.completed !== undefined) {
    if (query.completed !== "true" && query.completed !== "false") {
      throw new AppError("completed must be either true or false.", 400);
    }
    filters.completed = query.completed === "true";
  }

  return filters;
}

function validateTodoId(value) {
  const stringValue = String(value);
  if (!/^[1-9]\d*$/.test(stringValue)) {
    throw new AppError("Todo id must be a positive integer.", 400);
  }

  const id = Number(stringValue);
  if (!Number.isSafeInteger(id)) {
    throw new AppError("Todo id is invalid.", 400);
  }

  return id;
}

module.exports = {
  validateCreateTodo,
  validateUpdateTodo,
  validateTodoQuery,
  validateTodoId,
};
