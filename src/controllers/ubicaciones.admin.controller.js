// src/controllers/ubicaciones.admin.controller.js
const db = require("../config/database");

// ─── Listar ubicaciones ───────────────────────────────────────────────────────

const listar = async (req, res) => {
  const { empresa_id } = req.user;
  const { bodega_id } = req.query;

  try {
    const rows = await db.query(
      `SELECT id, nombre, bodega_id
       FROM ubicaciones
       WHERE empresa_id = ?
         AND (? IS NULL OR bodega_id = ?)
       ORDER BY nombre`,
      [empresa_id, bodega_id ?? null, bodega_id ?? null],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[ubicaciones.admin.listar]", error);
    return res.status(500).json({ message: "Error al obtener ubicaciones" });
  }
};

// ─── Crear ubicación ──────────────────────────────────────────────────────────

const crear = async (req, res) => {
  const { empresa_id } = req.user;
  const { nombre, bodega_id } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  try {
    await db.query(
      "INSERT INTO ubicaciones (nombre, bodega_id, empresa_id) VALUES (?, ?, ?)",
      [nombre.trim(), bodega_id ?? null, empresa_id],
    );

    // FIX: 201 al crear recurso nuevo
    return res.status(201).json({ message: "Ubicación creada correctamente" });
  } catch (error) {
    console.error("[ubicaciones.admin.crear]", error);
    return res.status(500).json({ message: "Error al crear la ubicación" });
  }
};

// ─── Actualizar ubicación ─────────────────────────────────────────────────────

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, bodega_id } = req.body;
  const { empresa_id } = req.user;

  // FIX: validar nombre antes de .trim()
  if (!nombre?.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  try {
    // FIX: verificar que la ubicación exista y pertenezca a la empresa
    const rows = await db.query(
      "SELECT id FROM ubicaciones WHERE id = ? AND empresa_id = ?",
      [id, empresa_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Ubicación no encontrada" });
    }

    await db.query(
      "UPDATE ubicaciones SET nombre = ?, bodega_id = ? WHERE id = ? AND empresa_id = ?",
      [nombre.trim(), bodega_id ?? null, id, empresa_id],
    );

    return res.json({ message: "Ubicación actualizada correctamente" });
  } catch (error) {
    console.error("[ubicaciones.admin.actualizar]", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar la ubicación" });
  }
};

// ─── Eliminar ubicación ───────────────────────────────────────────────────────

const eliminar = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.user;

  try {
    // FIX: rows[0].total en lugar de destructuring [uso] confuso
    const rows = await db.query(
      `SELECT COUNT(*) AS total
       FROM conteos
       WHERE ubicacion_id = ? AND empresa_id = ? AND estado = 'VIGENTE'`,
      [id, empresa_id],
    );

    if (rows[0]?.total > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar la ubicación porque tiene conteos asociados",
      });
    }

    await db.query("DELETE FROM ubicaciones WHERE id = ? AND empresa_id = ?", [
      id,
      empresa_id,
    ]);

    return res.json({ message: "Ubicación eliminada correctamente" });
  } catch (error) {
    console.error("[ubicaciones.admin.eliminar]", error);
    return res.status(500).json({ message: "Error al eliminar la ubicación" });
  }
};

module.exports = { listar, crear, actualizar, eliminar };
