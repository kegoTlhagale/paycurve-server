const jwt = require("jsonwebtoken");

const config = process.env;

const verifyToken = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) {
    return res.sendStatus(403);
  }
  try {
    const data = jwt.verify(token, config.TOKEN_KEY);
    req.userId = data.id;
    req.userRole = data.role;
    return next();
  } catch {
    return res.sendStatus(403);
  }
};

module.exports = verifyToken;