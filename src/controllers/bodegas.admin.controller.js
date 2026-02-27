// src/controllers/bodegas.admin.controller.js
const db = require("../config/database");

// ─── Listar bodegas de la empresa ─────────────────────────────────────────────

const listar = async (req, res) => {
  const { empresa_id } = req.user;

  try {
    const rows = await db.query(
      "SELECT id, nombre FROM bodegas WHERE empresa_id = ? ORDER BY nombre",
      [empresa_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[bodegas.admin.listar]", error);
    return res.status(500).json({ message: "Error al obtener bodegas" });
  }
};

// ─── Crear bodega ─────────────────────────────────────────────────────────────

const crear = async (req, res) => {
  const { empresa_id } = req.user;
  const { nombre } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  try {
    await db.query("INSERT INTO bodegas (nombre, empresa_id) VALUES (?, ?)", [
      nombre.trim(),
      empresa_id,
    ]);

    return res.status(201).json({ message: "Bodega creada correctamente" });
  } catch (error) {
    console.error("[bodegas.admin.crear]", error);
    return res.status(500).json({ message: "Error al crear la bodega" });
  }
};

// ─── Actualizar bodega ────────────────────────────────────────────────────────

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  const { empresa_id } = req.user;

  // FIX: validar nombre antes de hacer .trim()
  if (!nombre?.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  try {
    // FIX: verificar que la bodega exista y pertenezca a la empresa
    const rows = await db.query(
      "SELECT id FROM bodegas WHERE id = ? AND empresa_id = ?",
      [id, empresa_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Bodega no encontrada" });
    }

    await db.query(
      "UPDATE bodegas SET nombre = ? WHERE id = ? AND empresa_id = ?",
      [nombre.trim(), id, empresa_id],
    );

    return res.json({ message: "Bodega actualizada correctamente" });
  } catch (error) {
    console.error("[bodegas.admin.actualizar]", error);
    return res.status(500).json({ message: "Error al actualizar la bodega" });
  }
};

// ─── Eliminar bodega ──────────────────────────────────────────────────────────

const eliminar = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.user;

  try {
    // FIX: rows[0] en lugar de destructuring [uso] que es confuso
    const rows = await db.query(
      "SELECT COUNT(*) AS total FROM ubicaciones WHERE bodega_id = ? AND empresa_id = ?",
      [id, empresa_id],
    );

    const total = rows[0]?.total ?? 0;

    if (total > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar la bodega porque tiene ubicaciones asociadas",
      });
    }

    await db.query("DELETE FROM bodegas WHERE id = ? AND empresa_id = ?", [
      id,
      empresa_id,
    ]);

    return res.json({ message: "Bodega eliminada correctamente" });
  } catch (error) {
    console.error("[bodegas.admin.eliminar]", error);
    return res.status(500).json({ message: "Error al eliminar la bodega" });
  }
};

module.exports = { listar, crear, actualizar, eliminar };
