// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM usuarios WHERE username = ?",
      [username]
    );

    if (rows.length === 0)
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });

    const usuario = rows[0];

    if (!bcrypt.compareSync(password, usuario.password_hash))
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });

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
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

module.exports = router;
