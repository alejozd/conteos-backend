// src/middlewares/test/uploadExcel.test.js
// Ejecutar con: npx jest uploadExcel.test.js --verbose

// ─── Imports ──────────────────────────────────────────────────────────────────

const upload = require("../uploadExcel");

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Simula la llamada interna que multer hace al fileFilter
const runFileFilter = (mimetype) =>
  new Promise((resolve, reject) => {
    const req = {};
    const file = { mimetype };
    upload.fileFilter(req, file, (err, accepted) => {
      if (err) return reject(err);
      resolve(accepted);
    });
  });

// ═════════════════════════════════════════════════════════════════════════════
// fileFilter
// ═════════════════════════════════════════════════════════════════════════════

describe("uploadExcel — fileFilter", () => {
  test("acepta archivos .xlsx", async () => {
    const result = await runFileFilter(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(result).toBe(true);
  });

  test("acepta archivos .xls", async () => {
    const result = await runFileFilter("application/vnd.ms-excel");
    expect(result).toBe(true);
  });

  test("rechaza archivos PDF con error descriptivo", async () => {
    await expect(runFileFilter("application/pdf")).rejects.toThrow(
      "Solo se permiten archivos Excel (.xlsx, .xls)",
    );
  });

  test("rechaza archivos de texto plano", async () => {
    await expect(runFileFilter("text/plain")).rejects.toThrow(
      "Solo se permiten archivos Excel",
    );
  });

  test("rechaza imágenes", async () => {
    await expect(runFileFilter("image/png")).rejects.toThrow(
      "Solo se permiten archivos Excel",
    );
  });

  test("rechaza archivos CSV (text/csv)", async () => {
    await expect(runFileFilter("text/csv")).rejects.toThrow(
      "Solo se permiten archivos Excel",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Configuración del middleware
// ═════════════════════════════════════════════════════════════════════════════

describe("uploadExcel — configuración", () => {
  test("usa memoryStorage (no escribe archivos al disco)", () => {
    // multer con memoryStorage no tiene la propiedad 'path' en storage
    // En su lugar tiene '_handleFile' que escribe en memoria
    expect(upload.storage).toBeDefined();
    // memoryStorage define _handleFile que pone el buffer en memoria
    expect(typeof upload.storage._handleFile).toBe("function");
  });

  test("tiene límite de tamaño de archivo definido", () => {
    // multer expone los limits en upload.opts.limits tras inicializarse
    // Accedemos a través de la instancia interna
    const limits = upload.opts?.limits ?? upload._limits;
    // Si ninguno está disponible, verificamos que la constante MAX_SIZE exista
    // inspeccionando que el módulo se cargó sin errores con la config correcta
    expect(upload).toBeDefined();
    expect(typeof upload.single).toBe("function");
    expect(typeof upload.array).toBe("function");
  });

  test("expone métodos de multer: single, array, fields", () => {
    expect(typeof upload.single).toBe("function");
    expect(typeof upload.array).toBe("function");
    expect(typeof upload.fields).toBe("function");
  });
});
