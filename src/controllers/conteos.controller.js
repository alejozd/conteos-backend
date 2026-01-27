// src/controllers/conteos.controller.js
const db = require("../config/database");

const guardar = async (req, res) => {
  const { id, ubicacion_id, cantidad, conteo_grupo_id } = req.body;
  const usuario_id = req.user.id;
  const empresa_id = req.user.empresa_id;

  // Validaciones
  if (!id || !ubicacion_id || cantidad === undefined || !conteo_grupo_id) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }
  if (isNaN(cantidad) || cantidad < 0) {
    return res.status(400).json({ message: "Cantidad inválida" });
  }

  try {
    // NUEVA VALIDACIÓN: ¿El conteo sigue activo?
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

    // Buscamos el id del producto
    const rows = await db.query(
      "SELECT id, nombre, referencia FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1",
      [id, empresa_id],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Producto no encontrado" });

    const producto = rows[0]; // ahora sí es seguro

    // Insertamos el conteo
    await db.sequelize.query(
      `INSERT INTO conteos 
       (conteo_grupo_id, producto_id, ubicacion_id, cantidad, usuario_id, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          conteo_grupo_id,
          producto.id,
          ubicacion_id,
          cantidad,
          usuario_id,
          empresa_id,
        ],
      },
    );

    // Emitimos en vivo
    const io = req.app.get("io");
    if (io) {
      io.emit("nuevo-conteo", {
        conteo_grupo_id,
        referencia: producto.referencia || "",
        nombre: producto.nombre,
        cantidad,
        ubicacion_id,
        usuario: req.user.username,
        timestamp: new Date().toLocaleString("es-CO"),
      });
    }

    res.json({
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
    console.error("Error guardando conteo:", error.message);
    res.status(500).json({ message: "Error al guardar conteo" });
  }
};

const listarActivos = async (req, res) => {
  const empresa_id = req.user.empresa_id;

  try {
    const rows = await db.query(
      `SELECT id, fecha, descripcion, activo
       FROM conteos_grupos
       WHERE empresa_id = ? AND activo = 1
       ORDER BY fecha DESC`,
      [empresa_id],
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando grupos activos:", error.message);
    res.status(500).json({ message: "Error al listar grupos activos" });
  }
};

module.exports = { guardar, listarActivos };
