// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Token no proporcionado" });

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.role === "superadmin") {
      const empresaHeader = req.headers["x-empresa-id"];
      if (empresaHeader) {
        // Sobreescribimos el empresa_id del token con el del header
        payload.empresa_id = parseInt(empresaHeader);
      } else {
        // Si es superadmin pero no ha elegido empresa,
        // solo puede acceder a rutas de /api/admin/empresas
        if (!req.path.includes("/admin/empresas")) {
          return res
            .status(403)
            .json({ message: "Superadmin debe seleccionar una empresa" });
        }
      }
    }

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

const esSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Acceso denegado: requiere permisos de SuperAdmin" });
  }
};

module.exports = { verificarToken, esAdmin, esSuperAdmin };
