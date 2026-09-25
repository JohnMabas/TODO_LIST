function validate(validatorFn) {
  return function validateBody(req, _res, next) {
    try {
      req.validatedBody = validatorFn(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

validate.query = function validateQuery(validatorFn) {
  return function validateRequestQuery(req, _res, next) {
    try {
      req.validatedQuery = validatorFn(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = validate;
