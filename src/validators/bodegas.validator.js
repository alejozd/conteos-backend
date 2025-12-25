const nombresProcesados = new Set();

const validarBodega = async (row, index) => {
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

  row.NOMBRE = nombre;
  nombresProcesados.add(nombre);

  return null;
};

module.exports = validarBodega;
