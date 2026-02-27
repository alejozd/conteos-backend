// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");

// FIX: validar JWT_SECRET al arrancar el módulo, no en cada request
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido en las variables de entorno");
}

// ─── Verificar token JWT ──────────────────────────────────────────────────────

const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.role === "superadmin") {
      const empresaHeader = req.headers["x-empresa-id"];

      if (empresaHeader) {
        payload.empresa_id = parseInt(empresaHeader, 10);
      } else {
        // Superadmin puede acceder a /api/admin/empresas sin empresa seleccionada
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
    return next();
  } catch (error) {
    // FIX: distinguir token expirado de token malformado
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado" });
    }
    return res.status(403).json({ message: "Token inválido" });
  }
};

// ─── Verificar rol admin o superadmin ─────────────────────────────────────────

const esAdmin = (req, res, next) => {
  // FIX: verificar que req.user exista (por si el middleware se usa fuera de orden)
  if (!req.user) {
    return res.status(401).json({ message: "No autenticado" });
  }

  if (req.user.role === "admin" || req.user.role === "superadmin") {
    return next();
  }

  return res
    .status(403)
    .json({ message: "Acceso denegado: requiere rol administrativo" });
};

// ─── Verificar rol superadmin ─────────────────────────────────────────────────

const esSuperAdmin = (req, res, next) => {
  // FIX: eliminar console.log de debug
  // FIX: verificar que req.user exista
  if (!req.user) {
    return res.status(401).json({ message: "No autenticado" });
  }

  if (req.user.role === "superadmin") {
    return next();
  }

  return res
    .status(403)
    .json({ message: "Acceso denegado: requiere permisos de SuperAdmin" });
};

module.exports = { verificarToken, esAdmin, esSuperAdmin };
