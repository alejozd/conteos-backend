const xlsx = require("xlsx");
const db = require("../config/database");

const importarExcel = (tableName, columns) => async (req, res) => {
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
    const missing = columns.filter((c) => !excelColumns.includes(c));
    if (missing.length) {
      return res.status(400).json({
        message: "Columnas faltantes en el Excel",
        missing,
      });
    }

    const placeholders = columns.map(() => "?").join(", ");
    const sql = `
      INSERT INTO ${tableName} (${columns.join(", ")})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${columns
        .slice(1)
        .map((col) => `${col} = VALUES(${col})`)
        .join(", ")}
    `;

    let total = 0;

    for (const row of data) {
      const values = columns.map((col) => row[col] ?? null);

      // Validación mínima
      if (values[0] === null) continue;

      await db.query(sql, values);
      total++;
    }

    res.json({
      message: `${tableName} importada correctamente`,
      total,
    });
  } catch (error) {
    console.error(`Error importando ${tableName}:`, error);
    res.status(500).json({ message: `Error importando ${tableName}` });
  }
};

module.exports = importarExcel;
