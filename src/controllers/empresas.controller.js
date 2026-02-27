// src/controllers/empresas.controller.js
const db = require("../config/database");

// ─── Listar empresas ──────────────────────────────────────────────────────────

const getEmpresas = async (req, res) => {
  try {
    // FIX: columnas explícitas en lugar de SELECT * (evita exponer datos internos)
    // FIX: db.query en lugar de db.sequelize.query — más simple y consistente
    const rows = await db.query(
      "SELECT id, nombre, nit, descripcion, activo FROM empresas ORDER BY nombre ASC",
    );

    return res.json(rows);
  } catch (error) {
    console.error("[empresas.getEmpresas]", error);
    return res.status(500).json({ message: "Error al obtener empresas" });
  }
};

// ─── Crear empresa ────────────────────────────────────────────────────────────

const createEmpresa = async (req, res) => {
  const { nombre, nit, descripcion } = req.body;

  // FIX: validar campos obligatorios antes de operar
  if (!nombre?.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  if (!nit?.trim()) {
    return res.status(400).json({ message: "El NIT es obligatorio" });
  }

  try {
    await db.query(
      "INSERT INTO empresas (nombre, nit, descripcion, activo) VALUES (?, ?, ?, 1)",
      [nombre.trim(), nit.trim(), descripcion ?? null],
    );

    // FIX: 201 al crear un recurso nuevo
    return res.status(201).json({ message: "Empresa creada con éxito" });
  } catch (error) {
    console.error("[empresas.createEmpresa]", error);
    // FIX: no exponer error.message al cliente
    return res.status(500).json({ message: "Error al crear la empresa" });
  }
};

// ─── Actualizar empresa ───────────────────────────────────────────────────────

const updateEmpresa = async (req, res) => {
  const { id } = req.params;
  const { nombre, nit, descripcion, activo } = req.body;

  // FIX: validar campos obligatorios
  if (!nombre?.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  if (!nit?.trim()) {
    return res.status(400).json({ message: "El NIT es obligatorio" });
  }

  if (activo === undefined || activo === null) {
    return res.status(400).json({ message: "El campo activo es obligatorio" });
  }

  try {
    // FIX: verificar que la empresa exista antes de actualizar
    const rows = await db.query("SELECT id FROM empresas WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Empresa no encontrada" });
    }

    await db.query(
      "UPDATE empresas SET nombre = ?, nit = ?, descripcion = ?, activo = ? WHERE id = ?",
      [nombre.trim(), nit.trim(), descripcion ?? null, activo, id],
    );

    return res.json({ message: "Empresa actualizada correctamente" });
  } catch (error) {
    console.error("[empresas.updateEmpresa]", error);
    return res.status(500).json({ message: "Error al actualizar la empresa" });
  }
};

module.exports = { getEmpresas, createEmpresa, updateEmpresa };
