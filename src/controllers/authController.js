const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const userStore = require("../data/users");
const { jwtSecret, jwtExpiresIn } = require("../config/env");

const BCRYPT_SALT_ROUNDS = 10;

function toPublicUser(user) {
  const { password, ...publicUser } = user;
  return publicUser;
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

  if (userStore.findUserByEmail(email)) {
    throw new AppError("Email is already registered.", 409);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const user = userStore.createUser({
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
  const user = userStore.findUserByEmail(email);

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
