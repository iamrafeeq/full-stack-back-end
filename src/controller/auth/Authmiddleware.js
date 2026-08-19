import User from "../../models/userAuthModel.js";
import jwt from "jsonwebtoken";

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized." });
    }

    const decoded = jwt.verify(token, "secret");
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Not authorized." });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account deactivated.", deactivated: true });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized." });
  }
};

export default protect;
