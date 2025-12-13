const db = require("../config/database");

const listar = async (req, res) => {
  const empresa_id = req.user.empresa_id;

  try {
    const rows = await db.query(
      `SELECT id, nombre
       FROM bodegas
       WHERE empresa_id = ?
       ORDER BY nombre ASC`,
      [empresa_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando bodegas:", error.message);
    res.status(500).json({ message: "Error al cargar bodegas" });
  }
};

module.exports = { listar };
