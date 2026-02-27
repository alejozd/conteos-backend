// src/controllers/conteos.controller.js
const db = require("../config/database");

// ─── Guardar conteo ───────────────────────────────────────────────────────────

const guardar = async (req, res) => {
  const { id, ubicacion_id, cantidad, conteo_grupo_id } = req.body;
  const { id: usuario_id, empresa_id, username } = req.user;

  // Validación de campos obligatorios
  if (!id || !ubicacion_id || cantidad === undefined || !conteo_grupo_id) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  if (isNaN(cantidad) || cantidad < 0) {
    return res.status(400).json({ message: "Cantidad inválida" });
  }

  try {
    // Verificar que el grupo de conteo exista y esté activo
    const grupoRows = await db.query(
      "SELECT activo, descripcion FROM conteos_grupos WHERE id = ? AND empresa_id = ? LIMIT 1",
      [conteo_grupo_id, empresa_id],
    );

    if (grupoRows.length === 0) {
      return res.status(404).json({ message: "El grupo de conteo no existe." });
    }

    if (grupoRows[0].activo !== 1) {
      return res.status(403).json({
        message: `El conteo '${grupoRows[0].descripcion}' ha sido cerrado o desactivado. Por favor, refresca la página.`,
      });
    }

    // Verificar que el producto exista en la empresa
    const rows = await db.query(
      "SELECT id, nombre, referencia FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1",
      [id, empresa_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const producto = rows[0];

    // FIX: usar db.query en lugar de db.sequelize.query — consistente con el resto del proyecto
    await db.query(
      `INSERT INTO conteos
       (conteo_grupo_id, producto_id, ubicacion_id, cantidad, usuario_id, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        conteo_grupo_id,
        producto.id,
        ubicacion_id,
        cantidad,
        usuario_id,
        empresa_id,
      ],
    );

    // Emitir evento en tiempo real (best-effort)
    const io = req.app.get("io");
    if (io) {
      io.emit("nuevo-conteo", {
        conteo_grupo_id,
        referencia: producto.referencia || "",
        nombre: producto.nombre,
        cantidad,
        ubicacion_id,
        usuario: username,
        timestamp: new Date().toLocaleString("es-CO"),
      });
    }

    return res.json({
      message: "Conteo guardado correctamente",
      producto: {
        nombre: producto.nombre,
        referencia: producto.referencia || "-",
      },
      cantidad,
      ubicacion_id,
      timestamp: new Date().toLocaleString("es-CO"),
    });
  } catch (error) {
    // FIX: log completo, no solo error.message
    console.error("[conteos.guardar]", error);
    return res.status(500).json({ message: "Error al guardar conteo" });
  }
};

// ─── Listar grupos de conteo activos ─────────────────────────────────────────

const listarActivos = async (req, res) => {
  const { empresa_id } = req.user;

  try {
    const rows = await db.query(
      `SELECT id, fecha, descripcion, activo
       FROM conteos_grupos
       WHERE empresa_id = ? AND activo = 1
       ORDER BY fecha DESC`,
      [empresa_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[conteos.listarActivos]", error);
    return res.status(500).json({ message: "Error al listar grupos activos" });
  }
};

module.exports = { guardar, listarActivos };
