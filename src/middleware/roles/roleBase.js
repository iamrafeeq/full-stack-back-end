const authenticateRole = (...roles) => (req, res, next) => {
  if (req.user.role === "admin") return next();
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access forbidden: you do not have permission." });
  }
  next();
};

export default authenticateRole;
