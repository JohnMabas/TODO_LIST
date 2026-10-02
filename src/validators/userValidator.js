const AppError = require("../utils/AppError");

const NAME_MAX = 50;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const NAME_REGEX = /^[A-Za-z0-9 .'-]+$/;

function validateProfileUpdate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be a JSON object.", 400);
  }

  const allowedFields = ["name"];
  const unexpected = Object.keys(body).filter((field) => !allowedFields.includes(field));

  if (unexpected.length > 0) {
    throw new AppError(
      `Only name can be updated. Unexpected field: ${unexpected.join(", ")}.`,
      400
    );
  }

  if (typeof body.name !== "string") {
    throw new AppError("name must be a string.", 400);
  }

  const name = body.name.trim();

  if (name.length < 2 || name.length > NAME_MAX) {
    throw new AppError(`name must be between 2 and ${NAME_MAX} characters.`, 400);
  }

  if (!NAME_REGEX.test(name)) {
    throw new AppError("name may only contain letters, numbers, spaces, and . ' -", 400);
  }

  return { name };
}

function validatePasswordChange(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be a JSON object.", 400);
  }

  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    throw new AppError("currentPassword must be a non-empty string.", 400);
  }

  if (typeof newPassword !== "string") {
    throw new AppError("newPassword must be a string.", 400);
  }

  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    throw new AppError(
      `newPassword must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`,
      400
    );
  }

  if (currentPassword === newPassword) {
    throw new AppError("newPassword must differ from currentPassword.", 400);
  }

  return { currentPassword, newPassword };
}

function validateUserId(value) {
  const stringValue = String(value);

  if (!/^[1-9]\d*$/.test(stringValue)) {
    throw new AppError("User id must be a positive integer.", 400);
  }

  const id = Number(stringValue);

  if (!Number.isSafeInteger(id)) {
    throw new AppError("User id is invalid.", 400);
  }

  return id;
}

module.exports = {
  validateProfileUpdate,
  validatePasswordChange,
  validateUserId,
};