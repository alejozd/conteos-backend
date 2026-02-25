// src/controllers/auth.controller.js
const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// ─── Validación temprana de configuración crítica ─────────────────────────────
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido en las variables de entorno");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USUARIO_QUERY = `
  SELECT u.id, u.username, u.password, u.role, u.activo,
         u.empresa_id, e.nombre AS empresa_nombre
  FROM usuarios u
  LEFT JOIN empresas e ON e.id = u.empresa_id
  WHERE u.username = ?
  LIMIT 1
`;

const buildUserPayload = (usuario) => ({
  id: usuario.id,
  username: usuario.username,
  role: usuario.role,
  empresa_id: usuario.empresa_id,
  empresa_nombre: usuario.empresa_nombre,
});

// ─── Controller ───────────────────────────────────────────────────────────────

const login = async (req, res) => {
  const { username, password } = req.body;

  // Validación de campos obligatorios
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username y password son requeridos" });
  }

  try {
    const rows = await db.query(USUARIO_QUERY, [username]);

    // Mismo mensaje para usuario no encontrado y password incorrecto
    // evita enumerar usuarios válidos
    if (rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const usuario = rows[0];

    if (!usuario.activo) {
      return res
        .status(403)
        .json({ message: "Usuario inactivo. Contacte al administrador." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const payload = buildUserPayload(usuario);

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({ token, user: payload });
  } catch (error) {
    // Log interno detallado, respuesta externa genérica
    console.error("[auth.login] Error:", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
};

module.exports = { login };
