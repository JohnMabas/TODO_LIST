const express = require("express");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const todoController = require("../controllers/todoController");
const {
  validateCreateTodo,
  validateUpdateTodo,
  validateTodoQuery,
} = require("../validators/todoValidator");

const router = express.Router();

router.use(authenticate);
router.post("/", validate(validateCreateTodo), todoController.create);
router.get("/", validate.query(validateTodoQuery), todoController.list);
router.get("/:id", todoController.getById);
router.put("/:id", validate(validateUpdateTodo), todoController.update);
router.delete("/:id", todoController.delete);

module.exports = router;
