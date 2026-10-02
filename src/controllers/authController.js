const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const { jwtSecret, jwtExpiresIn } = require("../config/env");

const BCRYPT_SALT_ROUNDS = 10;

function toPublicUser(user) {
  return userRepository.toPublicUser(user);
}

function createToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      id: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validatedBody;
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const user = await userRepository.createUser({
    name,
    email,
    password: hashedPassword,
    role: "user",
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully.",
    data: toPublicUser(user),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.validatedBody;
  const user = await userRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid credentials.", 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new AppError("Invalid credentials.", 401);
  }

  res.status(200).json({
    success: true,
    message: "Login successful.",
    data: {
      token: createToken(user),
      user: toPublicUser(user),
    },
  });
});