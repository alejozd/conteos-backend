// src/controllers/admin.controller.js
const db = require("../config/database");

// API Key simple para Delphi (puedes cambiarla cuando quieras)
const API_KEY_VALID = process.env.API_KEY_DELPHI;

const importarSaldos = async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (apiKey !== API_KEY_VALID) {
    return res.status(401).json({ message: "API Key inválida" });
  }

  const { empresa_id = 1, saldos = [] } = req.body;

  if (!Array.isArray(saldos) || saldos.length === 0) {
    return res
      .status(400)
      .json({ message: "El array 'saldos' es obligatorio" });
  }

  try {
    // Borramos saldos anteriores de la empresa
    await db.sequelize.query("DELETE FROM saldos_global WHERE empresa_id = ?", {
      replacements: [empresa_id],
    });

    // Preparamos los valores para inserción masiva
    const values = saldos.map((item) => [
      item.codigo,
      item.subcodigo,
      item.referencia || null,
      parseFloat(item.saldo) || 0,
      new Date(),
      empresa_id,
    ]);

    await db.sequelize.query(
      `INSERT INTO saldos_global 
       (codigo, subcodigo, referencia, saldo, fecha_importacion, empresa_id) 
       VALUES ?`,
      { replacements: [values] }
    );

    // Emitimos evento para que el frontend admin lo vea en vivo
    const io = req.app.get("io");
    if (io) {
      io.emit("saldos-actualizados", { empresa_id, total: saldos.length });
    }

    res.json({
      message: "Saldos importados correctamente",
      empresa_id,
      registros: saldos.length,
      fecha: new Date().toLocaleString("es-CO"),
    });
  } catch (error) {
    console.error("Error importando saldos:", error.message);
    res.status(500).json({ message: "Error al importar saldos" });
  }
};

module.exports = { importarSaldos };

const cargarProductos = async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  if (apiKey !== API_KEY_VALID) {
    return res.status(401).json({ message: "API Key inválida" });
  }

  const { empresa_id = 1, productos = [] } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res
      .status(400)
      .json({ message: "El array 'productos' es obligatorio" });
  }

  try {
    // Borramos productos anteriores de la empresa
    await db.sequelize.query("DELETE FROM productos WHERE empresa_id = ?", {
      replacements: [empresa_id],
    });

    // Preparamos los valores para inserción masiva
    const values = productos.map((p) => [
      p.codigo,
      p.subcodigo,
      p.nombre || "",
      p.referencia || null,
      empresa_id,
    ]);

    await db.sequelize.query(
      `INSERT INTO productos 
       (codigo, subcodigo, nombre, referencia, empresa_id) 
       VALUES ?`,
      { replacements: [values] }
    );

    // Emitimos evento para que el frontend sepa que hay nuevo catálogo
    const io = req.app.get("io");
    if (io) {
      io.emit("catalogo-actualizado", { empresa_id, total: productos.length });
    }

    res.json({
      message: "Catálogo de productos cargado correctamente",
      empresa_id,
      registros: productos.length,
      fecha: new Date().toLocaleString("es-CO"),
    });
  } catch (error) {
    console.error("Error cargando productos:", error.message);
    res.status(500).json({ message: "Error al cargar productos" });
  }
};

module.exports = { importarSaldos, cargarProductos }; // ← exportamos los dos
