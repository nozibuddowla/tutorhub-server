// Simple input validation helpers (no extra lib needed)

const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Throw a 400 error with a message
const validationError = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

// Validate contact form body
const validateContact = (req, res, next) => {
  const { name, email, message } = req.body;
  if (!name?.trim()) return next(validationError("Name is required."));
  if (!email?.trim()) return next(validationError("Email is required."));
  if (!isEmail(email)) return next(validationError("Invalid email address."));
  if (!message?.trim()) return next(validationError("Message is required."));
  if (message.trim().length < 10)
    return next(validationError("Message must be at least 10 characters."));
  next();
};

// Validate user registration body
const validateRegister = (req, res, next) => {
  const { name, email, role } = req.body;
  if (!name?.trim()) return next(validationError("Name is required."));
  if (!email?.trim()) return next(validationError("Email is required."));
  if (!isEmail(email)) return next(validationError("Invalid email address."));
  if (role && !["student", "tutor", "admin"].includes(role)) {
    return next(validationError("Invalid role."));
  }
  next();
};

// Validate tuition post body
const validateTuition = (req, res, next) => {
  const { subject, location, salary } = req.body;
  if (!subject?.trim()) return next(validationError("Subject is required."));
  if (!location?.trim()) return next(validationError("Location is required."));
  if (salary !== undefined && (isNaN(salary) || Number(salary) < 0)) {
    return next(validationError("Salary must be a positive number."));
  }
  next();
};

module.exports = {
  validateContact,
  validateRegister,
  validateTuition,
  isEmail,
};
