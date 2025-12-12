// src/controllers/conteos.controller.js
const db = require("../config/database");

const guardar = async (req, res) => {
  const { codigo, subcodigo, ubicacion_id, cantidad, conteo_grupo_id } =
    req.body;
  const usuario_id = req.user.id;
  const empresa_id = req.user.empresa_id;

  // Validaciones
  if (
    !codigo ||
    !subcodigo ||
    !ubicacion_id ||
    cantidad === undefined ||
    !conteo_grupo_id
  ) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }
  if (isNaN(cantidad) || cantidad < 0) {
    return res.status(400).json({ message: "Cantidad inválida" });
  }

  try {
    // Buscamos el producto
    const rows = await db.query(
      "SELECT nombre, referencia FROM productos WHERE codigo = ? AND subcodigo = ? AND empresa_id = ? LIMIT 1",
      [codigo, subcodigo, empresa_id]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Producto no encontrado en catálogo" });
    }

    const producto = rows[0]; // ahora sí es seguro

    // Insertamos el conteo
    await db.sequelize.query(
      `INSERT INTO conteos 
       (conteo_grupo_id, codigo, subcodigo, ubicacion_id, cantidad, usuario_id, empresa_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      {
        replacements: [
          conteo_grupo_id,
          codigo,
          subcodigo,
          ubicacion_id,
          cantidad,
          usuario_id,
          empresa_id,
        ],
      }
    );

    // Emitimos en vivo
    const io = req.app.get("io");
    if (io) {
      io.emit("nuevo-conteo", {
        conteo_grupo_id,
        codigo,
        subcodigo,
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

module.exports = { guardar };
