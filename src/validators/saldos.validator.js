// src/validators/saldos.validator.js
const db = require("../config/database");

// FIX: este validator ahora hace todo lo que antes estaba inline en admin.routes.js:
// 1. Valida formato de REFERENCIA y SALDO
// 2. Resuelve REFERENCIA → producto_id consultando la DB
// 3. Asigna row.producto_id y row.saldo para que importarExcel los use en el INSERT
const validarSaldo = async (row, index, empresa_id) => {
  const fila = index + 2;

  if (!row.REFERENCIA) {
    return { fila, campo: "REFERENCIA", mensaje: "Referencia obligatoria" };
  }

  if (row.SALDO === undefined || row.SALDO === null) {
    return { fila, campo: "SALDO", mensaje: "Saldo obligatorio" };
  }

  if (isNaN(row.SALDO)) {
    return { fila, campo: "SALDO", mensaje: "El saldo debe ser numérico" };
  }

  if (Number(row.SALDO) < 0) {
    return { fila, campo: "SALDO", mensaje: "El saldo no puede ser negativo" };
  }

  // FIX: resolver REFERENCIA → producto_id (antes estaba en admin.routes.js)
  try {
    const [rows] = await db.sequelize.query(
      "SELECT id FROM productos WHERE referencia = ? AND empresa_id = ? LIMIT 1",
      { replacements: [row.REFERENCIA, empresa_id] },
    );

    if (!rows.length) {
      return {
        fila,
        campo: "REFERENCIA",
        mensaje: `Referencia '${row.REFERENCIA}' no existe`,
      };
    }

    // Asignar valores que importarExcel usará en el INSERT
    row.producto_id = rows[0].id;
    row.saldo = parseFloat(row.SALDO);
    row.empresa_id = empresa_id;
  } catch (e) {
    return { fila, campo: "DB", mensaje: e.message };
  }

  return null;
};

module.exports = validarSaldo;
