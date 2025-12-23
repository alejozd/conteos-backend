const validarSaldo = (row, index) => {
  const fila = index + 2;

  if (!row.CODIGO) {
    return { fila, campo: "CODIGO", mensaje: "Código obligatorio" };
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

  return null;
};

module.exports = validarSaldo;
