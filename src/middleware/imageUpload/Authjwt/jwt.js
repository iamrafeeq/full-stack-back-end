import jwt from "jsonwebtoken";
const getTokenFromHeader = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export default getTokenFromHeader;