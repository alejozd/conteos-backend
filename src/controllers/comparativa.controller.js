// src/controllers/comparativa.controller.js
const db = require("../config/database");
const { QueryTypes } = require("sequelize");

const getComparativa = async (req, res) => {
  const { ids } = req.query;
  const { empresa_id } = req.user;

  if (!ids) {
    return res.status(400).json({
      message: "Debe seleccionar al menos un conteo para comparar.",
    });
  }

  // FIX: parsear y validar que todos los ids sean enteros positivos
  // "1,abc,2".split(",").map(Number) → [1, NaN, 2] — NaN se interpolaría en el SQL
  const idsArray = ids
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  if (idsArray.length === 0) {
    return res.status(400).json({
      message: "Los ids proporcionados no son válidos.",
    });
  }

  try {
    // Los ids ya están validados como enteros positivos — interpolación segura
    const dynamicColumns = idsArray
      .map(
        (id) =>
          `SUM(CASE WHEN c.conteo_grupo_id = ${id} AND c.estado = 'VIGENTE' THEN c.cantidad ELSE 0 END) AS c_${id}`,
      )
      .join(", ");

    const idsPlaceholder = idsArray.join(",");

    const sql = `
      SELECT
          p.id,
          p.nombre,
          p.referencia,
          COALESCE(sg.saldo, 0) AS saldo_sistema,
          ${dynamicColumns}
      FROM (
          SELECT DISTINCT producto_id
          FROM conteos
          WHERE conteo_grupo_id IN (${idsPlaceholder})
            AND estado      = 'VIGENTE'
            AND empresa_id  = :empresa_id
      ) AS productos_contados
      INNER JOIN productos p
             ON p.id          = productos_contados.producto_id
            AND p.empresa_id  = :empresa_id
      LEFT JOIN saldos_global sg
             ON p.id          = sg.producto_id
            AND p.empresa_id  = sg.empresa_id
      LEFT JOIN conteos c
             ON p.id                  = c.producto_id
            AND c.conteo_grupo_id IN (${idsPlaceholder})
      GROUP BY p.id, p.nombre, p.referencia, sg.saldo
      ORDER BY p.nombre ASC
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { empresa_id },
      type: QueryTypes.SELECT,
    });

    return res.json(rows);
  } catch (error) {
    console.error("[comparativa.getComparativa]", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = { getComparativa };
