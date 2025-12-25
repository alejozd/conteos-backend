const xlsx = require("xlsx");
const db = require("../config/database");

const importarExcel =
  (tableName, columns, validarFila = null) =>
  async (req, res) => {
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

      const excelColumns = Object.keys(data[0]);
      const requiredColumns = columns.filter(
        (c) => !req.transformRow || excelColumns.includes(c)
      );
      const missing = requiredColumns.filter((c) => !excelColumns.includes(c));
      if (missing.length) {
        return res.status(400).json({
          message: "Columnas faltantes en el Excel",
          missing,
        });
      }

      const placeholders = columns.map(() => "?").join(", ");
      const updateCols = columns.slice(1);

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

      let total = 0;
      const errores = [];
      let insertados = 0;
      let actualizados = 0;
      const existsSql = `
        SELECT 1
        FROM ${tableName}
        WHERE ${columns[0]} = ?
        LIMIT 1
      `;

      for (let i = 0; i < data.length; i++) {
        let row = data[i];

        if (req.transformRow) {
          row = { ...row, ...req.transformRow(row) };
        }

        // 🔹 Validaciones específicas por entidad
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

        const [existe] = await db.sequelize.query(existsSql, {
          replacements: [values[0]],
        });

        // Ejecutar INSERT / UPDATE (el mismo SQL de siempre)
        await db.sequelize.query(sql, {
          replacements: values,
        });

        if (existe.length > 0) {
          actualizados++;
        } else {
          insertados++;
        }

        total++;
      }

      if (errores.length) {
        return res.status(400).json({
          message: "El archivo contiene errores",
          totalInsertados: total,
          errores,
        });
      }

      res.json({
        message: `${tableName} importada correctamente`,
        total,
        insertados,
        actualizados,
      });
    } catch (error) {
      console.error(`Error importando ${tableName}:`, error);
      res.status(500).json({ message: `Error importando ${tableName}` });
    }
  };

module.exports = importarExcel;
