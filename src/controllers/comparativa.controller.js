// src/controllers/comparativaController.js
const db = require("../config/database");
const { QueryTypes } = require("sequelize");

const getComparativa = async (req, res) => {
  try {
    const { ids } = req.query;
    const empresa_id = req.user.empresa_id; // Obtenemos la empresa del token

    if (!ids) {
      return res.status(400).json({
        message: "Debe seleccionar al menos un conteo para comparar.",
      });
    }

    const idsArray = ids.split(",").map(Number);

    // 1. Columnas dinámicas de conteos
    const dynamicColumns = idsArray
      .map(
        (id) =>
          `SUM(CASE WHEN c.conteo_grupo_id = ${id} AND c.estado = 'VIGENTE' THEN c.cantidad ELSE 0 END) AS c_${id}`
      )
      .join(",");

    // 2. Consulta con JOIN a productos para obtener el nombre
    const sql = `
    SELECT 
        p.id,        
        p.nombre,
        p.referencia,
        COALESCE(sg.saldo, 0) AS saldo_sistema,
        ${dynamicColumns}
    FROM (
        -- Primero identificamos solo los productos que tienen movimientos en esos conteos
        SELECT DISTINCT producto_id
        FROM conteos 
        WHERE conteo_grupo_id IN (${idsArray.join(",")}) 
          AND estado = 'VIGENTE'
          AND empresa_id = :empresa_id
    ) AS productos_contados
    INNER JOIN productos p ON p.id = productos_contados.producto_id         
        AND p.empresa_id = :empresa_id
    LEFT JOIN saldos_global sg ON p.id = sg.producto_id        
        AND p.empresa_id = sg.empresa_id
    LEFT JOIN conteos c ON p.id = c.producto_id        
        AND c.conteo_grupo_id IN (${idsArray.join(",")})
    GROUP BY p.id, p.nombre, p.referencia, sg.saldo
    ORDER BY p.nombre ASC
`;

    const rows = await db.sequelize.query(sql, {
      replacements: { empresa_id },
      type: QueryTypes.SELECT,
    });

    res.json(rows);
  } catch (error) {
    console.error("Error en comparativa:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = { getComparativa };
