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

//Cargar Productos
const cargarProductos = async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  if (apiKey !== API_KEY_VALID) {
    return res.status(401).json({ message: "API Key inválida" });
  }

  const { empresa_id = 1, productos = [] } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "El array 'productos' es obligatorio",
    });
  }

  const transaction = await db.sequelize.transaction();

  try {
    // 1️⃣ Borrado controlado
    // await db.sequelize.query("DELETE FROM productos WHERE empresa_id = ?", {
    //   replacements: [empresa_id],
    //   transaction,
    // });

    // 2️⃣ Validación
    const invalidos = productos.filter(
      (p) =>
        !p.codigo ||
        !p.subcodigo ||
        !p.nombre ||
        p.nombre.length > 255 ||
        (p.referencia && p.referencia.length > 100)
    );

    if (invalidos.length) {
      await transaction.rollback();
      return res.status(400).json({
        ok: false,
        message: "Productos inválidos",
        ejemplo: invalidos[0],
      });
    }

    const values = productos.map((p) => [
      p.codigo,
      p.subcodigo,
      p.nombre,
      p.referencia || null,
      empresa_id,
    ]);

    // 🔑 Chunk más pequeño
    const CHUNK_SIZE = 200;

    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);

      await db.sequelize.query(
        `INSERT INTO productos
          (codigo, subcodigo, nombre, referencia, empresa_id)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          nombre = VALUES(nombre),
          referencia = VALUES(referencia)`,
        {
          replacements: [chunk],
          transaction,
        }
      );
    }

    // 3️⃣ Commit final
    await transaction.commit();

    res.json({
      ok: true,
      message: "Catálogo cargado correctamente",
      empresa_id,
      registros: productos.length,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Error cargando productos:", error);

    res.status(500).json({
      ok: false,
      message: "Error al cargar productos",
      error: error.original?.sqlMessage || error.message,
    });
  }
};
module.exports = { cargarProductos };

const crearGrupoConteo = async (req, res) => {
  const { descripcion, fecha = new Date().toISOString().slice(0, 10) } =
    req.body;
  const empresa_id = req.user.empresa_id;

  if (!descripcion) {
    return res.status(400).json({ message: "La descripción es obligatoria" });
  }

  try {
    const result = await db.sequelize.query(
      `INSERT INTO conteos_grupos 
       (fecha, descripcion, empresa_id, created_at) 
       VALUES (?, ?, ?, NOW())`,
      {
        replacements: [fecha, descripcion, empresa_id],
      }
    );

    const grupoId = result[0]; // ID del nuevo grupo

    // Emitimos evento para que el frontend admin lo vea
    const io = req.app.get("io");
    if (io) {
      io.emit("grupo-creado", {
        id: grupoId,
        fecha,
        descripcion,
        empresa_id,
      });
    }

    res.json({
      message: "Grupo de conteo creado correctamente",
      grupo_id: grupoId,
      descripcion,
      fecha,
    });
  } catch (error) {
    console.error("Error creando grupo:", error.message);
    res.status(500).json({ message: "Error al crear grupo" });
  }
};

const listarGruposConteo = async (req, res) => {
  const empresa_id = req.user.empresa_id;

  try {
    const rows = await db.query(
      `SELECT id, fecha, descripcion, created_at 
       FROM conteos_grupos 
       WHERE empresa_id = ? 
       ORDER BY fecha DESC, created_at DESC`,
      [empresa_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando grupos:", error.message);
    res.status(500).json({ message: "Error al listar grupos" });
  }
};

const listarSaldosResumen = async (req, res) => {
  const empresa_id = req.user.empresa_id;

  try {
    const rows = await db.query(
      `
      SELECT
  p.codigo,
  p.subcodigo,
  p.nombre,
  p.referencia,
  COALESCE(sg.saldo, 0) AS saldo_sistema,
  COALESCE(SUM(c.cantidad), 0) AS conteo_total,
  COALESCE(sg.saldo, 0) - COALESCE(SUM(c.cantidad), 0) AS diferencia
FROM productos p
LEFT JOIN saldos_global sg
  ON sg.codigo = p.codigo
 AND sg.subcodigo = p.subcodigo
 AND sg.empresa_id = p.empresa_id
LEFT JOIN conteos c
  ON c.codigo = p.codigo
 AND c.subcodigo = p.subcodigo
 AND c.empresa_id = p.empresa_id
WHERE p.empresa_id = ?
GROUP BY
  p.codigo,
  p.subcodigo,
  p.nombre,
  p.referencia,
  sg.saldo
ORDER BY p.nombre;

      `,
      [empresa_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando saldos resumen:", error.message);
    res.status(500).json({ message: "Error al obtener saldos" });
  }
};

module.exports = {
  importarSaldos,
  cargarProductos,
  crearGrupoConteo,
  listarGruposConteo,
  listarSaldosResumen,
};
