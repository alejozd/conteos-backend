// src/controllers/bodegas.controller.js
const db = require("../config/database");

const listar = async (req, res) => {
  const { empresa_id } = req.user;

  try {
    const rows = await db.query(
      `SELECT id, nombre
       FROM bodegas
       WHERE empresa_id = ?
       ORDER BY nombre ASC`,
      [empresa_id],
    );

    return res.json(rows);
  } catch (error) {
    // FIX: log completo del error, no solo error.message
    console.error("[bodegas.listar]", error);
    return res.status(500).json({ message: "Error al cargar bodegas" });
  }
};

module.exports = { listar };
