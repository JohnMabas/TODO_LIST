const bcrypt = require("bcryptjs");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const userRepository = require("../repositories/userRepository");

const BCRYPT_SALT_ROUNDS = 10;

exports.getMe = asyncHandler(async (req, res) => {
  const user = await userRepository.findUserById(req.user.id);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Profile retrieved successfully.",
    data: userRepository.toPublicUser(user),
  });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await userRepository.updateUserById(req.user.id, req.validatedBody);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: user,
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validatedBody;
  const user = await userRepository.findUserById(req.user.id);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);

  if (!passwordMatches) {
    throw new AppError("Current password is incorrect.", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await userRepository.updateUserById(req.user.id, { password: hashedPassword });

  res.status(200).json({
    success: true,
    message: "Password changed successfully.",
    data: null,
  });
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const deleted = await userRepository.deleteUserById(req.user.id);

  if (!deleted) {
    throw new AppError("User not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Account deleted successfully. All todos were removed.",
    data: null,
  });
});