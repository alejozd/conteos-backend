// src/controllers/auth.controller.js
const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const rows = await db.query("SELECT * FROM usuarios WHERE username = ?", [
      username,
    ]);

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const usuario = rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message: "Usuario inactivo. Contacte al administrador.",
      });
    }

    if (!bcrypt.compareSync(password, usuario.password)) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        username: usuario.username,
        role: usuario.role,
        empresa_id: usuario.empresa_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    res.json({
      token,
      user: {
        id: usuario.id,
        username: usuario.username,
        role: usuario.role,
        empresa_id: usuario.empresa_id,
      },
    });
  } catch (error) {
    console.error("Error en login:", error.message);
    res.status(500).json({ message: "Error del servidor" });
  }
};

module.exports = { login };
