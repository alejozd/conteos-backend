// src/validators/ubicaciones.validator.js
const db = require("../config/database");

// FIX: mismo bug que bodegas — clear() en cada fila borraba el set antes de verificar
const procesados = new Set();

const validarUbicacion = async (row, index, empresa_id) => {
  // FIX: limpiar solo al procesar la primera fila
  if (index === 0) {
    procesados.clear();
  }

  const bodega = row.BODEGA?.trim().toUpperCase();
  const ubicacion = row.UBICACION?.trim().toUpperCase();

  if (!bodega || !ubicacion) {
    return {
      fila: index + 2,
      mensaje: "BODEGA y UBICACION son obligatorias",
    };
  }

  const key = `${bodega}::${ubicacion}`;

  if (procesados.has(key)) {
    return {
      fila: index + 2,
      mensaje: "Ubicación duplicada en el archivo",
    };
  }

  try {
    const [rows] = await db.sequelize.query(
      "SELECT id FROM bodegas WHERE nombre = ? AND empresa_id = ?",
      { replacements: [bodega, empresa_id] },
    );

    if (!rows.length) {
      return {
        fila: index + 2,
        campo: "BODEGA",
        mensaje: `La bodega "${bodega}" no existe`,
      };
    }

    // Asignar valores que importarExcel usará en el INSERT
    row.BODEGA_ID = rows[0].id;
    row.NOMBRE = ubicacion;

    procesados.add(key);
  } catch (e) {
    return { fila: index + 2, campo: "DB", mensaje: e.message };
  }

  return null;
};

module.exports = validarUbicacion;
