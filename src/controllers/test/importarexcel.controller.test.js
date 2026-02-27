// src/controllers/test/importarExcel.controller.test.js
// Ejecutar con: npx jest importarExcel.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({
  query: jest.fn(),
  sequelize: {
    query: jest.fn(),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

jest.mock("xlsx");

const db = require("../../config/database");
const xlsx = require("xlsx");

const importarExcel = require("../importarExcel.controller");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  file: { buffer: Buffer.from("fake-excel") },
  user: { id: 1, empresa_id: 1 },
  ...overrides,
});

// Simula que xlsx.read devuelve datos con las columnas indicadas
const mockXlsxData = (rows) => {
  xlsx.read.mockReturnValue({
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: {},
    },
  });
  xlsx.utils.sheet_to_json.mockReturnValue(rows);
};

const COLUMNS = ["referencia", "nombre", "precio"];
const TABLE = "productos";

// Handler generado para los tests
const handler = importarExcel(TABLE, COLUMNS);

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// Validaciones iniciales
// ═════════════════════════════════════════════════════════════════════════════

describe("validaciones iniciales", () => {
  test("400 si tableName no está en la whitelist", async () => {
    const handlerInvalido = importarExcel("usuarios_secretos", COLUMNS);
    const req = makeReq();
    const res = makeRes();

    await handlerInvalido(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("no permitida"),
      }),
    );
  });

  test("400 si no se envía archivo", async () => {
    const req = makeReq({ file: null });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "No se recibió ningún archivo" }),
    );
  });

  test("400 si el Excel está vacío", async () => {
    mockXlsxData([]);

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El archivo está vacío" }),
    );
  });

  test("400 si faltan columnas requeridas en el Excel", async () => {
    // Solo tiene 'referencia', faltan 'nombre' y 'precio'
    mockXlsxData([{ referencia: "REF-1" }]);

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Columnas faltantes en el Excel",
        missing: expect.arrayContaining(["nombre", "precio"]),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flujo de importación exitosa
// ═════════════════════════════════════════════════════════════════════════════

describe("importación exitosa", () => {
  test("inserta filas nuevas correctamente (affectedRows=1)", async () => {
    mockXlsxData([
      { referencia: "REF-1", nombre: "Producto A", precio: 100 },
      { referencia: "REF-2", nombre: "Producto B", precio: 200 },
    ]);

    // affectedRows=1 → INSERT nuevo
    db.sequelize.query
      .mockResolvedValueOnce([[], { affectedRows: 1 }])
      .mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        insertados: 2,
        actualizados: 0,
      }),
    );
  });

  test("cuenta actualizaciones correctamente (affectedRows=2)", async () => {
    mockXlsxData([{ referencia: "REF-1", nombre: "Producto A", precio: 150 }]);

    // affectedRows=2 → ON DUPLICATE KEY UPDATE
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 2 }]);

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        insertados: 0,
        actualizados: 1,
      }),
    );
  });

  test("mezcla de inserts y updates correctamente", async () => {
    mockXlsxData([
      { referencia: "REF-1", nombre: "Nuevo", precio: 100 },
      { referencia: "REF-2", nombre: "Existente", precio: 200 },
      { referencia: "REF-3", nombre: "Otro nuevo", precio: 300 },
    ]);

    db.sequelize.query
      .mockResolvedValueOnce([[], { affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[], { affectedRows: 2 }]) // update
      .mockResolvedValueOnce([[], { affectedRows: 1 }]); // insert

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 3,
        insertados: 2,
        actualizados: 1,
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Validación por fila
// ═════════════════════════════════════════════════════════════════════════════

describe("validación por fila", () => {
  test("omite filas donde el campo clave es null", async () => {
    mockXlsxData([
      { referencia: null, nombre: "Sin ref", precio: 50 },
      { referencia: "REF-1", nombre: "Con ref", precio: 100 },
    ]);

    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    // Solo 1 fila válida, 1 error
    expect(res.status).toHaveBeenCalledWith(207);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        errores: expect.arrayContaining([
          expect.objectContaining({
            campo: "referencia",
            mensaje: "Campo obligatorio vacío",
          }),
        ]),
      }),
    );
  });

  test("usa validarFila personalizada y registra errores", async () => {
    mockXlsxData([
      { referencia: "REF-1", nombre: "Válido", precio: 100 },
      { referencia: "REF-2", nombre: "Inválido", precio: -5 },
    ]);

    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const validarFila = jest.fn().mockImplementation((row, i) => {
      if (row.precio < 0)
        return { fila: i + 2, campo: "precio", mensaje: "Precio negativo" };
      return null;
    });

    const handlerConValidacion = importarExcel(TABLE, COLUMNS, validarFila);

    const req = makeReq();
    const res = makeRes();

    await handlerConValidacion(req, res);

    expect(validarFila).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(207);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        errores: expect.arrayContaining([
          expect.objectContaining({ mensaje: "Precio negativo" }),
        ]),
      }),
    );
  });

  test("400 si todas las filas fallan validación (total = 0)", async () => {
    mockXlsxData([
      { referencia: null, nombre: "Sin ref 1", precio: 50 },
      { referencia: null, nombre: "Sin ref 2", precio: 80 },
    ]);

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 0,
        errores: expect.any(Array),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// transformRow
// ═════════════════════════════════════════════════════════════════════════════

describe("transformRow", () => {
  test("aplica transformación antes de insertar", async () => {
    mockXlsxData([{ referencia: "ref-1", nombre: "producto a", precio: 100 }]);

    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const req = makeReq({
      transformRow: (row) => ({
        referencia: row.referencia.toUpperCase(),
        nombre: row.nombre.toUpperCase(),
      }),
    });
    const res = makeRes();

    await handler(req, res);

    // Verifica que los values del INSERT usaron los datos transformados
    const callArgs = db.sequelize.query.mock.calls[0][1];
    expect(callArgs.replacements).toContain("REF-1");
    expect(callArgs.replacements).toContain("PRODUCTO A");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Manejo de errores
// ═════════════════════════════════════════════════════════════════════════════

describe("manejo de errores", () => {
  test("500 si falla la lectura del Excel", async () => {
    xlsx.read.mockImplementation(() => {
      throw new Error("Archivo corrupto");
    });

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("500 si falla la query de INSERT", async () => {
    mockXlsxData([{ referencia: "REF-1", nombre: "Producto A", precio: 100 }]);
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
