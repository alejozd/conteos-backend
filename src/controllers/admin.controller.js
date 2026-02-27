// src/controllers/admin.controller.js
const db = require("../config/database");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_KEY_VALID = process.env.API_KEY_DELPHI;
const CHUNK_SIZE = 200;

/**
 * Middleware reutilizable para validar API Key.
 * Úsalo directamente en las rutas: router.post("/importar", validateApiKey, importarSaldos)
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  if (!apiKey || apiKey !== API_KEY_VALID) {
    return res.status(401).json({ ok: false, message: "API Key inválida" });
  }
  next();
};

// ─── Importar Saldos ─────────────────────────────────────────────────────────

/**
 * POST /admin/saldos/importar
 * Recibe un array de { referencia, saldo } y reemplaza los saldos globales
 * de la empresa dentro de una transacción atómica.
 *
 * FIX: El DELETE + INSERT ahora están dentro de la misma transacción.
 * Antes, si el INSERT fallaba los saldos quedaban borrados definitivamente.
 */
const importarSaldos = async (req, res) => {
  const { empresa_id = 1, saldos = [] } = req.body;

  if (!Array.isArray(saldos) || saldos.length === 0) {
    return res
      .status(400)
      .json({ ok: false, message: "El array 'saldos' es obligatorio" });
  }

  const transaction = await db.sequelize.transaction();

  try {
    // 1. Obtener catálogo para mapear Referencia → ID
    const productos = await db.sequelize.query(
      "SELECT id, referencia FROM productos WHERE empresa_id = ?",
      {
        replacements: [empresa_id],
        type: db.sequelize.QueryTypes.SELECT,
        transaction,
      },
    );

    const mapaProductos = Object.fromEntries(
      productos.map((p) => [p.referencia, p.id]),
    );

    // 2. Preparar valores filtrando referencias inexistentes
    const values = saldos
      .map((item) => {
        const pId = mapaProductos[item.referencia];
        return pId
          ? [pId, parseFloat(item.saldo) || 0, new Date(), empresa_id]
          : null;
      })
      .filter(Boolean);

    if (values.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "Ninguna referencia de la lista existe en el catálogo de productos",
      });
    }

    // 3. Reemplazar saldos dentro de la transacción (atómico)
    await db.sequelize.query("DELETE FROM saldos_global WHERE empresa_id = ?", {
      replacements: [empresa_id],
      transaction,
    });

    await db.sequelize.query(
      `INSERT INTO saldos_global (producto_id, saldo, fecha_importacion, empresa_id) VALUES ?`,
      { replacements: [values], transaction },
    );

    await transaction.commit();

    // 4. Notificar por socket (fuera de la transacción, es best-effort)
    const io = req.app.get("io");
    if (io) {
      io.emit("saldos-actualizados", { empresa_id, total: values.length });
    }

    return res.json({
      ok: true,
      message: "Saldos importados correctamente",
      empresa_id,
      registros: values.length,
      fecha: new Date().toLocaleString("es-CO"),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("[admin.importarSaldos]", error);
    return res
      .status(500)
      .json({ ok: false, message: "Error al importar saldos" });
  }
};

// ─── Cargar Productos ─────────────────────────────────────────────────────────

/**
 * POST /admin/productos/cargar
 * Inserta o actualiza productos en chunks para evitar timeouts con volúmenes grandes.
 */
const cargarProductos = async (req, res) => {
  const { empresa_id = 1, productos = [] } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res
      .status(400)
      .json({ ok: false, message: "El array 'productos' es obligatorio" });
  }

  const transaction = await db.sequelize.transaction();

  try {
    const values = productos.map((p) => [
      p.nombre,
      p.referencia || null,
      empresa_id,
    ]);

    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      await db.sequelize.query(
        `INSERT INTO productos (nombre, referencia, empresa_id) VALUES ?
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), referencia = VALUES(referencia)`,
        { replacements: [chunk], transaction },
      );
    }

    await transaction.commit();
    return res.json({ ok: true, registros: productos.length });
  } catch (error) {
    await transaction.rollback();
    console.error("[admin.cargarProductos]", error);
    return res.status(500).json({
      ok: false,
      message: "Error al cargar productos",
      error: error.original?.sqlMessage || error.message,
    });
  }
};

// ─── Listar Productos ─────────────────────────────────────────────────────────

/**
 * GET /admin/productos
 */
const listarProductos = async (req, res) => {
  const { empresa_id } = req.user;

  try {
    const rows = await db.query(
      `SELECT id, nombre, referencia
       FROM productos
       WHERE empresa_id = ?
       ORDER BY nombre`,
      [empresa_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[admin.listarProductos]", error);
    return res
      .status(500)
      .json({ message: "Error obteniendo lista de productos" });
  }
};

// ─── Saldos Resumen ───────────────────────────────────────────────────────────

/**
 * GET /admin/saldos/resumen?conteo_grupo_id=X
 */
const listarSaldosResumen = async (req, res) => {
  const { empresa_id } = req.user;
  const { conteo_grupo_id } = req.query;

  if (!conteo_grupo_id) {
    return res.status(400).json({ message: "conteo_grupo_id es obligatorio" });
  }

  try {
    const rows = await db.query(
      `SELECT
          p.id,
          p.nombre,
          p.referencia,
          COALESCE(sg.saldo, 0)        AS saldo_sistema,
          COALESCE(SUM(c.cantidad), 0) AS conteo_total,
          COALESCE(sg.saldo, 0) - COALESCE(SUM(c.cantidad), 0) AS diferencia
       FROM productos p
       LEFT JOIN saldos_global sg
              ON sg.producto_id = p.id AND sg.empresa_id = p.empresa_id
       LEFT JOIN conteos c
              ON c.producto_id    = p.id
             AND c.empresa_id     = p.empresa_id
             AND c.estado         = 'VIGENTE'
             AND c.conteo_grupo_id = ?
       WHERE p.empresa_id = ?
       GROUP BY p.id, p.nombre, p.referencia, sg.saldo
       ORDER BY p.nombre`,
      [conteo_grupo_id, empresa_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[admin.listarSaldosResumen]", error);
    return res.status(500).json({ message: "Error al obtener saldos" });
  }
};

// ─── Conteos Detalle ──────────────────────────────────────────────────────────

/**
 * GET /admin/conteos/detalle?conteo_grupo_id=X&producto_id=Y
 */
const listarConteosDetalle = async (req, res) => {
  const { empresa_id } = req.user;
  const { conteo_grupo_id, producto_id } = req.query;

  if (!conteo_grupo_id || !producto_id) {
    return res.status(400).json({
      message: "Faltan parámetros obligatorios: conteo_grupo_id, producto_id",
    });
  }

  try {
    const rows = await db.query(
      `SELECT
          c.id,
          c.cantidad,
          c.estado,
          c.timestamp,
          u.username        AS usuario,
          ub.nombre         AS ubicacion,
          b.nombre          AS bodega,
          c.motivo_anulacion,
          c.fecha_anulacion,
          ua.username       AS usuario_anula
       FROM conteos c
       JOIN  usuarios u  ON u.id  = c.usuario_id
       LEFT JOIN usuarios ua  ON ua.id = c.usuario_anula
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       LEFT JOIN bodegas b      ON b.id  = ub.bodega_id
       WHERE c.producto_id     = ?
         AND c.empresa_id      = ?
         AND c.conteo_grupo_id = ?
       ORDER BY c.timestamp DESC`,
      [producto_id, empresa_id, conteo_grupo_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[admin.listarConteosDetalle]", error);
    return res
      .status(500)
      .json({ message: "Error obteniendo detalle de conteos" });
  }
};

// ─── Anular Conteo ────────────────────────────────────────────────────────────

/**
 * PATCH /admin/conteos/:id/anular?conteo_grupo_id=X
 *
 * FIX: La detección de filas afectadas usaba result[1] === 0, que asume
 * la estructura interna de Sequelize y puede variar. Ahora verificamos
 * con affectedRows que es más robusto y legible.
 */
const anularConteo = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  const { id: usuario_anula, empresa_id } = req.user;
  const { conteo_grupo_id } = req.query;

  if (!motivo?.trim()) {
    return res
      .status(400)
      .json({ message: "El motivo de anulación es obligatorio" });
  }

  if (!conteo_grupo_id) {
    return res.status(400).json({ message: "conteo_grupo_id es obligatorio" });
  }

  try {
    const [, meta] = await db.sequelize.query(
      `UPDATE conteos
       SET estado           = 'ANULADO',
           motivo_anulacion = ?,
           usuario_anula    = ?,
           fecha_anulacion  = NOW()
       WHERE id              = ?
         AND empresa_id      = ?
         AND conteo_grupo_id = ?
         AND estado          = 'VIGENTE'`,
      {
        replacements: [
          motivo.trim(),
          usuario_anula,
          id,
          empresa_id,
          conteo_grupo_id,
        ],
      },
    );

    // meta.affectedRows es el campo estándar en Sequelize con MySQL/MariaDB
    if (!meta?.affectedRows) {
      return res
        .status(404)
        .json({ message: "Conteo no encontrado o ya anulado" });
    }

    return res.json({ message: "Conteo anulado correctamente" });
  } catch (error) {
    console.error("[admin.anularConteo]", error);
    return res.status(500).json({ message: "Error al anular conteo" });
  }
};

// ─── Conteos Anulados ─────────────────────────────────────────────────────────

/**
 * GET /admin/conteos/anulados?conteo_grupo_id=X
 *
 * FIX: Agrega validación de conteo_grupo_id que faltaba en el original.
 */
const getConteosAnulados = async (req, res) => {
  const { empresa_id } = req.user;
  const { conteo_grupo_id } = req.query;

  if (!conteo_grupo_id) {
    return res.status(400).json({ message: "conteo_grupo_id es obligatorio" });
  }

  try {
    const rows = await db.query(
      `SELECT
          c.id,
          p.nombre          AS producto,
          c.cantidad,
          b.nombre          AS bodega,
          u.nombre          AS ubicacion,
          uc.username       AS usuario_conteo,
          ua.username       AS usuario_anulacion,
          c.motivo_anulacion,
          c.timestamp       AS fecha_conteo,
          c.fecha_anulacion
       FROM conteos c
       LEFT JOIN productos p   ON p.id  = c.producto_id
       LEFT JOIN ubicaciones u ON u.id  = c.ubicacion_id
       LEFT JOIN bodegas b     ON b.id  = u.bodega_id
       LEFT JOIN usuarios uc   ON uc.id = c.usuario_id
       LEFT JOIN usuarios ua   ON ua.id = c.usuario_anula
       WHERE c.estado          = 'ANULADO'
         AND c.empresa_id      = ?
         AND c.conteo_grupo_id = ?
       ORDER BY c.fecha_anulacion DESC`,
      [empresa_id, conteo_grupo_id],
    );

    return res.json(rows);
  } catch (error) {
    console.error("[admin.getConteosAnulados]", error);
    return res
      .status(500)
      .json({ message: "Error obteniendo conteos anulados" });
  }
};

// ─── Stats de Conteos ─────────────────────────────────────────────────────────

/**
 * GET /admin/conteos/stats?conteo_grupo_id=X
 */
const conteos_stats = async (req, res) => {
  const { empresa_id } = req.user;
  const { conteo_grupo_id } = req.query;

  if (!conteo_grupo_id) {
    return res.status(400).json({ message: "conteo_grupo_id es obligatorio" });
  }

  try {
    const rows = await db.query(
      `SELECT
          COUNT(*)       AS total_registros,
          SUM(cantidad)  AS total_cantidad
       FROM conteos
       WHERE empresa_id      = ?
         AND conteo_grupo_id = ?
         AND estado          = 'VIGENTE'`,
      [empresa_id, conteo_grupo_id],
    );

    return res.json(rows[0] ?? { total_registros: 0, total_cantidad: 0 });
  } catch (error) {
    console.error("[admin.conteos_stats]", error);
    return res.status(500).json({ message: "Error obteniendo conteos stats" });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  validateApiKey,
  importarSaldos,
  cargarProductos,
  listarProductos,
  listarSaldosResumen,
  listarConteosDetalle,
  anularConteo,
  getConteosAnulados,
  conteos_stats,
};
