// src/controllers/productos.controller.js
const db = require("../config/database");

const buscar = async (req, res) => {
  const empresa_id = req.user.empresa_id;
  const { texto = "" } = req.query;

  if (!texto || texto.trim().length < 2) return res.json([]);

  const search = `%${texto.trim().toUpperCase()}%`;

  try {
    const rows = await db.query(
      `SELECT 
         p.codigo,
         p.subcodigo,
         p.referencia,
         p.nombre,
         COALESCE(s.saldo, 0) as saldo_sistema
       FROM productos p
       LEFT JOIN saldos_global s 
         ON s.codigo = p.codigo 
        AND s.subcodigo = p.subcodigo 
        AND s.empresa_id = p.empresa_id
       WHERE p.empresa_id = ?
         AND (
           CAST(p.codigo AS CHAR) LIKE ?
           OR CAST(p.subcodigo AS CHAR) LIKE ?
           OR UPPER(p.referencia) LIKE ?
           OR UPPER(p.nombre) LIKE ?
         )
       ORDER BY p.codigo, p.subcodigo
       LIMIT 50`,
      [empresa_id, search, search, search, search]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error búsqueda:", error);
    res.status(500).json({ message: "Error en búsqueda" });
  }
};

module.exports = { buscar };
