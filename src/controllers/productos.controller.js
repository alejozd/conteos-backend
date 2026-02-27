// src/controllers/productos.controller.js
const db = require("../config/database");

const buscar = async (req, res) => {
  const { empresa_id } = req.user;
  const { texto = "" } = req.query;

  // Retorna vacío si el texto es muy corto — sin tocar la DB
  if (!texto || texto.trim().length < 2) {
    return res.json([]);
  }

  const search = `%${texto.trim().toUpperCase()}%`;

  try {
    const rows = await db.query(
      `SELECT
           p.id,
           p.referencia,
           p.nombre,
           COALESCE(s.saldo, 0) AS saldo_sistema
       FROM productos p
       LEFT JOIN saldos_global s
              ON s.producto_id = p.id
             AND s.empresa_id  = p.empresa_id
       WHERE p.empresa_id = ?
         AND (
           UPPER(p.referencia) LIKE ?
           OR UPPER(p.nombre)  LIKE ?
         )
       ORDER BY p.nombre
       LIMIT 50`,
      [empresa_id, search, search],
    );

    return res.json(rows);
  } catch (error) {
    // FIX: log completo + prefijo estándar
    console.error("[productos.buscar]", error);
    return res.status(500).json({ message: "Error en búsqueda" });
  }
};

module.exports = { buscar };
