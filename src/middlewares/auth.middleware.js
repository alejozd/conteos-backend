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
        payload.empresa_id = parseInt(empresaHeader);
      } else {
        // PERMITIR rutas de empresas si no ha seleccionado una aún
        // Usamos una expresión regular para ser más precisos
        const esRutaEmpresas = /\/api\/admin\/empresas/.test(
          req.originalUrl || req.path,
        );

        if (!esRutaEmpresas) {
          return res.status(403).json({
            message:
              "Superadmin debe seleccionar una empresa para acceder a este recurso",
          });
        }
      }
    }

    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token inválido o expirado" });
  }
};

const esAdmin = (req, res, next) => {
  if (req.user.role === "admin" || req.user.role === "superadmin") {
    next();
  } else {
    return res
      .status(403)
      .json({ message: "Acceso denegado: requiere rol administrativo" });
  }
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
