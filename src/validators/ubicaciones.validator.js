const db = require("../config/database");
const procesados = new Set();

const validarUbicacion = async (row, index, empresa_id) => {
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

  const [rows] = await db.sequelize.query(
    `SELECT id FROM bodegas WHERE nombre = ? AND empresa_id = ?`,
    { replacements: [bodega, empresa_id] }
  );

  if (!rows.length) {
    return {
      fila: index + 2,
      campo: "BODEGA",
      mensaje: `La bodega "${bodega}" no existe`,
    };
  }

  // 🔹 Aquí resolvemos lo técnico
  row.BODEGA_ID = rows[0].id;
  row.NOMBRE = ubicacion;

  procesados.add(key);
  return null;
};

module.exports = validarUbicacion;
