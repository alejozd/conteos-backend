// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Token no proporcionado" });

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, username, role, empresa_id }
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token inválido o expirado" });
  }
};

const esAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res
      .status(403)
      .json({ message: "Acceso denegado: requiere rol admin" });
  next();
};

module.exports = { verificarToken, esAdmin };
