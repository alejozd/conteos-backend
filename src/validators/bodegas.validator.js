// src/validators/bodegas.validator.js

// FIX: el Set se crea fuera del validator y se limpia UNA SOLA VEZ
// antes del loop en importarExcel. Pero como importarExcel llama al validator
// por cada fila sin un hook de "inicio", usamos una solución con closure:
// reseteamos cuando index === 0 (primera fila del archivo).
const nombresProcesados = new Set();

const validarBodega = async (row, index) => {
  // FIX: limpiar solo al procesar la primera fila, no en cada llamada
  if (index === 0) {
    nombresProcesados.clear();
  }

  const nombre = row.NOMBRE?.trim().toUpperCase();

  if (!nombre) {
    return {
      fila: index + 2,
      campo: "NOMBRE",
      mensaje: "El nombre de la bodega es obligatorio",
    };
  }

  if (nombresProcesados.has(nombre)) {
    return {
      fila: index + 2,
      campo: "NOMBRE",
      mensaje: "Bodega duplicada en el archivo",
    };
  }

  // Normalizar nombre en la fila antes de insertar
  row.NOMBRE = nombre;
  nombresProcesados.add(nombre);

  return null;
};

module.exports = validarBodega;
