const db = require("../config/database");

const listar = async (req, res) => {
  const empresa_id = req.user.empresa_id;
  const { bodega_id } = req.query;

  const rows = await db.query(
    `SELECT id, nombre, bodega_id
     FROM ubicaciones
     WHERE empresa_id = ?
       AND (? IS NULL OR bodega_id = ?)
     ORDER BY nombre`,
    [empresa_id, bodega_id, bodega_id]
  );

  res.json(rows);
};

const crear = async (req, res) => {
  const empresa_id = req.user.empresa_id;
  const { nombre, bodega_id } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  await db.query(
    `INSERT INTO ubicaciones (nombre, bodega_id, empresa_id)
     VALUES (?, ?, ?)`,
    [nombre.trim(), bodega_id || null, empresa_id]
  );

  res.json({ message: "Ubicación creada correctamente" });
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, bodega_id } = req.body;
  const empresa_id = req.user.empresa_id;

  await db.query(
    `UPDATE ubicaciones
     SET nombre = ?, bodega_id = ?
     WHERE id = ? AND empresa_id = ?`,
    [nombre.trim(), bodega_id || null, id, empresa_id]
  );

  res.json({ message: "Ubicación actualizada correctamente" });
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  const empresa_id = req.user.empresa_id;

  const [uso] = await db.query(
    `SELECT COUNT(*) AS total
     FROM conteos
     WHERE ubicacion_id = ?
       AND empresa_id = ?
       AND estado = 'VIGENTE'`,
    [id, empresa_id]
  );

  if (uso.total > 0) {
    return res.status(400).json({
      message:
        "No se puede eliminar la ubicación porque tiene conteos asociados",
    });
  }

  await db.query(`DELETE FROM ubicaciones WHERE id = ? AND empresa_id = ?`, [
    id,
    empresa_id,
  ]);

  res.json({ message: "Ubicación eliminada correctamente" });
};

module.exports = { listar, crear, actualizar, eliminar };
