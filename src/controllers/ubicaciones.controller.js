// src/controllers/ubicaciones.controller.js
const db = require("../config/database");

const listarPorBodega = async (req, res) => {
  const { empresa_id } = req.user;
  const { bodegaId } = req.query;

  // FIX: validar parámetro obligatorio antes de consultar la DB
  if (!bodegaId) {
    return res.status(400).json({ message: "bodegaId es obligatorio" });
  }

  try {
    const rows = await db.query(
      `SELECT id, nombre
       FROM ubicaciones
       WHERE empresa_id = ?
         AND bodega_id  = ?
       ORDER BY nombre ASC`,
      [empresa_id, bodegaId],
    );

    return res.json(rows);
  } catch (error) {
    // FIX: log completo + prefijo estándar
    console.error("[ubicaciones.listarPorBodega]", error);
    return res.status(500).json({ message: "Error al cargar ubicaciones" });
  }
};

module.exports = { listarPorBodega };
