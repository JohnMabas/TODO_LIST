const AppError = require("../utils/AppError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 50;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;

function requireObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be a JSON object.", 400);
  }
}

function requireStringField(body, field, label) {
  const value = body[field];
  if (typeof value !== "string") {
    throw new AppError(`${label} must be a string.`, 400);
  }
  return value;
}

function validateRegister(body) {
  requireObject(body);

  const rawName = body.name === undefined ? "User" : requireStringField(body, "name", "name");
  const email = requireStringField(body, "email", "email").trim().toLowerCase();
  const password = requireStringField(body, "password", "password");
  const name = rawName.trim();

  if (name.length < 2 || name.length > NAME_MAX) {
    throw new AppError(`name must be between 2 and ${NAME_MAX} characters.`, 400);
  }

  if (!EMAIL_REGEX.test(email) || email.length > EMAIL_MAX) {
    throw new AppError("email must be a valid email address.", 400);
  }

  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new AppError(
      `password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`,
      400
    );
  }

  return { name, email, password };
}

function validateLogin(body) {
  requireObject(body);

  const email = requireStringField(body, "email", "email").trim().toLowerCase();
  const password = requireStringField(body, "password", "password");

  if (!EMAIL_REGEX.test(email) || email.length > EMAIL_MAX) {
    throw new AppError("email must be a valid email address.", 400);
  }

  if (password.length === 0 || password.length > PASSWORD_MAX) {
    throw new AppError("password must be a non-empty string.", 400);
  }

  return { email, password };
}

module.exports = {
  validateRegister,
  validateLogin,
};
