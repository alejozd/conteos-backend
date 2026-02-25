// src/controllers/conteosGrupos.controller.js
const db = require("../config/database");

// ─── Crear grupo de conteo ────────────────────────────────────────────────────

const crearGrupoConteo = async (req, res) => {
  const { descripcion, fecha = new Date().toISOString().slice(0, 10) } =
    req.body;
  const { empresa_id } = req.user;

  if (!descripcion?.trim()) {
    return res.status(400).json({ message: "La descripción es obligatoria" });
  }

  try {
    // FIX: destructuring directo sin variable intermedia grupoId
    const [insertId] = await db.sequelize.query(
      `INSERT INTO conteos_grupos
       (fecha, descripcion, empresa_id, activo, created_at)
       VALUES (?, ?, ?, 0, NOW())`,
      { replacements: [fecha, descripcion.trim(), empresa_id] },
    );

    return res.status(201).json({
      message:
        "Grupo creado (Inactivo). Actívelo manualmente para iniciar el conteo.",
      grupo_id: insertId,
      fecha,
      descripcion: descripcion.trim(),
    });
  } catch (error) {
    console.error("[conteosGrupos.crearGrupoConteo]", error);
    return res.status(500).json({ message: "Error al crear grupo de conteo" });
  }
};

// ─── Listar grupos de conteo ──────────────────────────────────────────────────

const listarGruposConteo = async (req, res) => {
  const { empresa_id } = req.user;

  try {
    const rows = await db.query(
      `SELECT id, fecha, descripcion, activo, created_at
       FROM conteos_grupos
       WHERE empresa_id = ?
       ORDER BY fecha DESC, created_at DESC`,
      [empresa_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[conteosGrupos.listarGruposConteo]", error);
    return res
      .status(500)
      .json({ message: "Error al listar grupos de conteo" });
  }
};

// ─── Editar grupo de conteo ───────────────────────────────────────────────────

const editarGrupoConteo = async (req, res) => {
  const { id } = req.params;
  const { descripcion, fecha } = req.body;
  const { empresa_id } = req.user;

  // FIX: validaciones ANTES del try
  if (!descripcion?.trim()) {
    return res.status(400).json({ message: "La descripción es obligatoria" });
  }

  if (!fecha) {
    return res.status(400).json({ message: "La fecha es obligatoria" });
  }

  try {
    // FIX: verificar que el grupo exista y pertenezca a la empresa
    const grupo = await db.query(
      "SELECT id FROM conteos_grupos WHERE id = ? AND empresa_id = ? LIMIT 1",
      [id, empresa_id],
    );

    if (grupo.length === 0) {
      return res.status(404).json({ message: "Grupo de conteo no encontrado" });
    }

    // Verificar que no tenga conteos asociados
    // FIX: usar db.query en vez de db.sequelize.query — más simple y consistente
    const conteos = await db.query(
      "SELECT COUNT(*) AS total FROM conteos WHERE conteo_grupo_id = ?",
      [id],
    );

    if (Number(conteos[0]?.total) > 0) {
      return res.status(400).json({
        message:
          "No se puede editar el conteo porque ya tiene registros asociados",
      });
    }

    await db.query(
      "UPDATE conteos_grupos SET descripcion = ?, fecha = ? WHERE id = ? AND empresa_id = ?",
      [descripcion.trim(), fecha, id, empresa_id],
    );

    return res.json({ message: "Grupo de conteo actualizado correctamente" });
  } catch (error) {
    console.error("[conteosGrupos.editarGrupoConteo]", error);
    return res.status(500).json({ message: "Error al editar grupo de conteo" });
  }
};

// ─── Activar grupo de conteo ──────────────────────────────────────────────────

const activarGrupoConteo = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.user;

  try {
    // FIX: eliminar transacción innecesaria para un solo UPDATE.
    // FIX: usar [, meta] para obtener affectedRows correctamente.
    const [, meta] = await db.sequelize.query(
      "UPDATE conteos_grupos SET activo = 1 WHERE id = ? AND empresa_id = ?",
      { replacements: [id, empresa_id] },
    );

    if (!meta?.affectedRows) {
      return res
        .status(404)
        .json({ message: "No se encontró el grupo para activar" });
    }

    return res.json({ message: "Grupo de conteo activado correctamente" });
  } catch (error) {
    console.error("[conteosGrupos.activarGrupoConteo]", error);
    return res
      .status(500)
      .json({ message: "Error al activar grupo de conteo" });
  }
};

// ─── Desactivar grupo de conteo ───────────────────────────────────────────────

const desactivarGrupoConteo = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.user;

  try {
    const [, meta] = await db.sequelize.query(
      "UPDATE conteos_grupos SET activo = 0 WHERE id = ? AND empresa_id = ?",
      { replacements: [id, empresa_id] },
    );

    if (!meta?.affectedRows) {
      return res
        .status(404)
        .json({ message: "No se encontró el grupo para desactivar" });
    }

    return res.json({ message: "Grupo de conteo desactivado correctamente" });
  } catch (error) {
    console.error("[conteosGrupos.desactivarGrupoConteo]", error);
    return res
      .status(500)
      .json({ message: "Error al desactivar grupo de conteo" });
  }
};

module.exports = {
  crearGrupoConteo,
  listarGruposConteo,
  editarGrupoConteo,
  activarGrupoConteo,
  desactivarGrupoConteo,
};
