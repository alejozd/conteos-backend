// src/controllers/ubicaciones.controller.js
const db = require("../config/database");

const listarPorBodega = async (req, res) => {
  const empresa_id = req.user.empresa_id;
  const { bodegaId } = req.params;

  try {
    const rows = await db.query(
      `SELECT id, nombre
       FROM ubicaciones
       WHERE empresa_id = ?
         AND bodega_id = ?
       ORDER BY nombre ASC`,
      [empresa_id, bodegaId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando ubicaciones:", error.message);
    res.status(500).json({ message: "Error al cargar ubicaciones" });
  }
};

module.exports = { listarPorBodega };
