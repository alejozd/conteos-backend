// src/controllers/importarExcel.controller.js
const xlsx = require("xlsx");
const db = require("../config/database");

// FIX: whitelist de tablas permitidas — previene SQL injection en tableName
const TABLAS_PERMITIDAS = new Set([
  "productos",
  "saldos_global",
  "ubicaciones",
  "bodegas",
  "usuarios",
]);

/**
 * Higher-order function que genera un handler de importación de Excel.
 *
 * @param {string}   tableName   - Nombre de la tabla destino (debe estar en TABLAS_PERMITIDAS)
 * @param {string[]} columns     - Columnas en el orden del INSERT. La primera se usa como clave.
 * @param {Function} validarFila - (opcional) async (row, index, empresa_id) => string|null
 */
const importarExcel =
  (tableName, columns, validarFila = null) =>
  async (req, res) => {
    // FIX: validar tableName contra whitelist antes de cualquier operación
    if (!TABLAS_PERMITIDAS.has(tableName)) {
      return res
        .status(400)
        .json({ message: `Tabla no permitida: ${tableName}` });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ningún archivo" });
    }

    try {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (!data.length) {
        return res.status(400).json({ message: "El archivo está vacío" });
      }

      // FIX: validación de columnas independiente de transformRow
      const excelColumns = Object.keys(data[0]);
      const missing = columns.filter((c) => !excelColumns.includes(c));

      if (missing.length) {
        return res.status(400).json({
          message: "Columnas faltantes en el Excel",
          missing,
        });
      }

      const placeholders = columns.map(() => "?").join(", ");
      const updateCols = columns.slice(1);

      // tableName y columns son seguros: tableName pasó la whitelist,
      // columns son strings definidos en código (no vienen del cliente)
      const sql = `
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
        ${
          updateCols.length
            ? "ON DUPLICATE KEY UPDATE " +
              updateCols.map((col) => `${col} = VALUES(${col})`).join(", ")
            : ""
        }
      `;

      let insertados = 0;
      let actualizados = 0;
      const errores = [];

      for (let i = 0; i < data.length; i++) {
        let row = data[i];

        if (req.transformRow) {
          row = { ...row, ...req.transformRow(row) };
        }

        // Validaciones específicas por entidad
        if (validarFila) {
          const error = await validarFila(row, i, req.user?.empresa_id);
          if (error) {
            errores.push(error);
            continue;
          }
        }

        const values = columns.map((col) => row[col] ?? null);

        if (values[0] === null) {
          errores.push({
            fila: i + 2,
            campo: columns[0],
            mensaje: "Campo obligatorio vacío",
          });
          continue;
        }

        // FIX: usar affectedRows en lugar de SELECT EXISTS por cada fila
        // MySQL ON DUPLICATE KEY UPDATE: affectedRows=1 → insert, affectedRows=2 → update
        const [, meta] = await db.sequelize.query(sql, {
          replacements: values,
        });

        if (meta?.affectedRows === 2) {
          actualizados++;
        } else {
          insertados++;
        }
      }

      const total = insertados + actualizados;

      // FIX: si hubo filas válidas Y errores, responder 207 con el detalle completo
      // (antes retornaba 400 aunque hubiera importado filas exitosamente)
      if (errores.length) {
        return res.status(total > 0 ? 207 : 400).json({
          message:
            total > 0
              ? "Importación parcial con errores"
              : "El archivo contiene errores",
          total,
          insertados,
          actualizados,
          errores,
        });
      }

      return res.json({
        message: `${tableName} importada correctamente`,
        total,
        insertados,
        actualizados,
      });
    } catch (error) {
      console.error(`[importarExcel.${tableName}]`, error);
      return res.status(500).json({ message: `Error importando ${tableName}` });
    }
  };

module.exports = importarExcel;
