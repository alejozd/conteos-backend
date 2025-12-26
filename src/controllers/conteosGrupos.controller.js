const db = require("../config/database");

/**
 * Crear un nuevo grupo de conteo
 */
const crearGrupoConteo = async (req, res) => {
  const { descripcion, fecha = new Date().toISOString().slice(0, 10) } =
    req.body;
  const empresa_id = req.user.empresa_id;

  if (!descripcion?.trim()) {
    return res.status(400).json({ message: "La descripción es obligatoria" });
  }

  try {
    const [result] = await db.sequelize.query(
      `INSERT INTO conteos_grupos
       (fecha, descripcion, empresa_id, activo, created_at)
       VALUES (?, ?, ?, 1, NOW())`,
      {
        replacements: [fecha, descripcion.trim(), empresa_id],
      }
    );

    const grupoId = result;

    res.json({
      message: "Grupo de conteo creado correctamente",
      grupo_id: grupoId,
      fecha,
      descripcion,
    });
  } catch (error) {
    console.error("Error creando grupo de conteo:", error);
    res.status(500).json({ message: "Error al crear grupo de conteo" });
  }
};

/**
 * Listar grupos de conteo de la empresa
 */
const listarGruposConteo = async (req, res) => {
  const empresa_id = req.user.empresa_id;

  try {
    const rows = await db.query(
      `SELECT id, fecha, descripcion, activo, created_at
       FROM conteos_grupos
       WHERE empresa_id = ? AND activo = 1
       ORDER BY fecha DESC, created_at DESC`,
      [empresa_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando grupos de conteo:", error);
    res.status(500).json({ message: "Error al listar grupos de conteo" });
  }
};

/**
 * Editar grupo de conteo
 * Solo si no tiene conteos asociados
 */
const editarGrupoConteo = async (req, res) => {
  const { id } = req.params;
  const { descripcion, fecha } = req.body;
  const empresa_id = req.user.empresa_id;

  try {
    if (!descripcion?.trim()) {
      return res.status(400).json({
        message: "La descripción es obligatoria",
      });
    }

    // Validar que no tenga conteos asociados
    const [rows] = await db.sequelize.query(
      `SELECT COUNT(*) AS total
        FROM conteos
        WHERE conteo_grupo_id = ?`,
      {
        replacements: [id],
      }
    );

    const total = Number(rows?.[0]?.total || 0);

    if (total > 0) {
      return res.status(400).json({
        message:
          "No se puede editar el conteo porque ya tiene registros asociados",
      });
    }

    await db.sequelize.query(
      `UPDATE conteos_grupos
       SET descripcion = ?, fecha = ?
       WHERE id = ? AND empresa_id = ?`,
      {
        replacements: [descripcion?.trim(), fecha, id, empresa_id],
      }
    );

    res.json({ message: "Grupo de conteo actualizado correctamente" });
  } catch (error) {
    console.error("Error editando grupo de conteo:", error);
    res.status(500).json({ message: "Error al editar grupo de conteo" });
  }
};

/**
 * Desactivar grupo de conteo (NO se borra)
 */
const desactivarGrupoConteo = async (req, res) => {
  const { id } = req.params;
  const empresa_id = req.user.empresa_id;

  try {
    // Validar que no tenga conteos asociados
    // Validar que no tenga conteos asociados
    const [rows] = await db.sequelize.query(
      `SELECT COUNT(*) AS total
        FROM conteos
        WHERE conteo_grupo_id = ?`,
      {
        replacements: [id],
      }
    );

    const total = Number(rows?.[0]?.total || 0);

    if (total > 0) {
      return res.status(400).json({
        message:
          "No se puede editar el conteo porque ya tiene registros asociados",
      });
    }

    await db.sequelize.query(
      `UPDATE conteos_grupos
       SET activo = 0
       WHERE id = ? AND empresa_id = ?`,
      {
        replacements: [id, empresa_id],
      }
    );

    res.json({ message: "Grupo de conteo desactivado correctamente" });
  } catch (error) {
    console.error("Error desactivando grupo de conteo:", error);
    res.status(500).json({ message: "Error al desactivar grupo de conteo" });
  }
};

module.exports = {
  crearGrupoConteo,
  listarGruposConteo,
  editarGrupoConteo,
  desactivarGrupoConteo,
};
