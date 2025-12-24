const db = require("../config/database");

const listar = async (req, res) => {
  const empresa_id = req.user.empresa_id;
  const rows = await db.query(
    `SELECT id, nombre FROM bodegas WHERE empresa_id = ? ORDER BY nombre`,
    [empresa_id]
  );
  res.json(rows);
};

const crear = async (req, res) => {
  const empresa_id = req.user.empresa_id;
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  await db.query(`INSERT INTO bodegas (nombre, empresa_id) VALUES (?, ?)`, [
    nombre.trim(),
    empresa_id,
  ]);

  res.json({ message: "Bodega creada correctamente" });
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  const empresa_id = req.user.empresa_id;

  await db.query(
    `UPDATE bodegas SET nombre = ? WHERE id = ? AND empresa_id = ?`,
    [nombre.trim(), id, empresa_id]
  );

  res.json({ message: "Bodega actualizada correctamente" });
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  const empresa_id = req.user.empresa_id;

  await db.query(`DELETE FROM bodegas WHERE id = ? AND empresa_id = ?`, [
    id,
    empresa_id,
  ]);

  res.json({ message: "Bodega eliminada correctamente" });
};

module.exports = { listar, crear, actualizar, eliminar };
