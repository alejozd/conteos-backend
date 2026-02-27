// src/controllers/test/admin.controller.test.js
// Ejecutar con:  npx jest admin.controller.test.js --verbose

// ─── Mocks ANTES de cualquier import ─────────────────────────────────────────

jest.mock("../../config/database", () => ({
  query: jest.fn(),
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
    // QueryTypes debe ser un objeto real porque el controlador lo accede
    // como db.sequelize.QueryTypes.SELECT en tiempo de ejecución
    QueryTypes: { SELECT: "SELECT" },
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const db = require("../../config/database");

const {
  validateApiKey,
  importarSaldos,
  cargarProductos,
  listarProductos,
  listarSaldosResumen,
  listarConteosDetalle,
  anularConteo,
  getConteosAnulados,
  conteos_stats,
} = require("../admin.controller");

// ─── Transacción mock ─────────────────────────────────────────────────────────

let mockTransaction;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (overrides = {}) => ({
  headers: {},
  query: {},
  params: {},
  body: {},
  user: { id: 1, empresa_id: 1 },
  app: { get: jest.fn().mockReturnValue(null) },
  ...overrides,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.API_KEY_DELPHI = "test-api-key-123";
});

beforeEach(() => {
  jest.clearAllMocks();

  mockTransaction = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  db.sequelize.transaction.mockResolvedValue(mockTransaction);
});

// ═════════════════════════════════════════════════════════════════════════════
// validateApiKey
// ═════════════════════════════════════════════════════════════════════════════

describe("validateApiKey", () => {
  // API_KEY_VALID se asigna al cargar el módulo (const API_KEY_VALID = process.env.API_KEY_DELPHI)
  // jest.isolateModules fuerza una carga fresca del módulo con la env ya seteada

  test("llama next() con API Key válida en header", () => {
    let fn;
    jest.isolateModules(() => {
      process.env.API_KEY_DELPHI = "test-api-key-123";
      ({ validateApiKey: fn } = require("../admin.controller"));
    });

    const req = makeReq({ headers: { "x-api-key": "test-api-key-123" } });
    const res = makeRes();
    const next = jest.fn();

    fn(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("llama next() con API Key válida en query param", () => {
    let fn;
    jest.isolateModules(() => {
      process.env.API_KEY_DELPHI = "test-api-key-123";
      ({ validateApiKey: fn } = require("../admin.controller"));
    });

    const req = makeReq({ query: { apiKey: "test-api-key-123" } });
    const res = makeRes();
    const next = jest.fn();

    fn(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("retorna 401 con API Key inválida", () => {
    const req = makeReq({ headers: { "x-api-key": "wrong-key" } });
    const res = makeRes();
    const next = jest.fn();

    validateApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 401 si no hay API Key", () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    validateApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// importarSaldos
// ═════════════════════════════════════════════════════════════════════════════

describe("importarSaldos", () => {
  test("400 si saldos está vacío", async () => {
    const req = makeReq({ body: { saldos: [] } });
    const res = makeRes();

    await importarSaldos(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("saldos"),
      }),
    );
  });

  test("400 si ninguna referencia existe en el catálogo", async () => {
    // Con QueryTypes.SELECT, Sequelize devuelve solo el array de filas (sin metadata)
    // Array vacío = ningún producto encontrado
    db.sequelize.query.mockResolvedValueOnce([]);

    const req = makeReq({
      body: { empresa_id: 1, saldos: [{ referencia: "REF-X", saldo: 10 }] },
    });
    const res = makeRes();

    await importarSaldos(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  test("importa saldos correctamente y hace commit", async () => {
    // FIX CLAVE: Con QueryTypes.SELECT, db.sequelize.query devuelve directamente
    // el array de filas, NO [rows, metadata]. El controlador asigna:
    //   const productos = await db.sequelize.query(..., { type: QueryTypes.SELECT })
    // entonces productos = [{ id: 1, referencia: "REF-001" }]  ← array plano
    db.sequelize.query
      .mockResolvedValueOnce([{ id: 1, referencia: "REF-001" }]) // SELECT → array plano
      .mockResolvedValueOnce([[], {}]) // DELETE
      .mockResolvedValueOnce([[], {}]); // INSERT

    const req = makeReq({
      body: { empresa_id: 1, saldos: [{ referencia: "REF-001", saldo: 50 }] },
    });
    const res = makeRes();

    await importarSaldos(req, res);

    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, registros: 1 }),
    );
  });

  test("hace rollback y retorna 500 si falla el DELETE", async () => {
    // SELECT OK → productos encontrados, luego DELETE lanza error
    db.sequelize.query
      .mockResolvedValueOnce([{ id: 1, referencia: "REF-001" }])
      .mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({
      body: { empresa_id: 1, saldos: [{ referencia: "REF-001", saldo: 10 }] },
    });
    const res = makeRes();

    await importarSaldos(req, res);

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("emite evento de socket si io está disponible", async () => {
    const mockEmit = jest.fn();

    db.sequelize.query
      .mockResolvedValueOnce([{ id: 1, referencia: "REF-001" }])
      .mockResolvedValueOnce([[], {}])
      .mockResolvedValueOnce([[], {}]);

    const req = makeReq({
      body: { empresa_id: 1, saldos: [{ referencia: "REF-001", saldo: 5 }] },
      app: { get: jest.fn().mockReturnValue({ emit: mockEmit }) },
    });
    const res = makeRes();

    await importarSaldos(req, res);

    expect(mockEmit).toHaveBeenCalledWith("saldos-actualizados", {
      empresa_id: 1,
      total: 1,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// cargarProductos
// ═════════════════════════════════════════════════════════════════════════════

describe("cargarProductos", () => {
  test("400 si productos está vacío", async () => {
    const req = makeReq({ body: { productos: [] } });
    const res = makeRes();

    await cargarProductos(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("inserta productos en chunks correctamente y hace commit", async () => {
    db.sequelize.query.mockResolvedValue([[], {}]);

    const productos = Array.from({ length: 5 }, (_, i) => ({
      nombre: `Producto ${i}`,
      referencia: `REF-${i}`,
    }));

    const req = makeReq({ body: { empresa_id: 1, productos } });
    const res = makeRes();

    await cargarProductos(req, res);

    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, registros: 5 }),
    );
  });

  test("hace rollback y retorna 500 con sqlMessage si falla el INSERT", async () => {
    // FIX: el controlador usa error.original?.sqlMessage || error.message
    // Para que llegue "Duplicate entry" debemos construir el error con .original
    const dbError = new Error("DB error genérico");
    dbError.original = { sqlMessage: "Duplicate entry" };

    db.sequelize.query.mockRejectedValueOnce(dbError);

    const req = makeReq({
      body: { productos: [{ nombre: "P1", referencia: "R1" }] },
    });
    const res = makeRes();

    await cargarProductos(req, res);

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: "Duplicate entry" }),
    );
  });

  test("retorna error.message si no hay sqlMessage", async () => {
    // Caso sin error.original → usa el message genérico
    db.sequelize.query.mockRejectedValueOnce(new Error("Connection timeout"));

    const req = makeReq({
      body: { productos: [{ nombre: "P1", referencia: "R1" }] },
    });
    const res = makeRes();

    await cargarProductos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: "Connection timeout" }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listarProductos
// ═════════════════════════════════════════════════════════════════════════════

describe("listarProductos", () => {
  test("retorna lista de productos", async () => {
    const mockProductos = [
      { id: 1, nombre: "Producto A", referencia: "REF-A" },
      { id: 2, nombre: "Producto B", referencia: "REF-B" },
    ];
    db.query.mockResolvedValueOnce(mockProductos);

    const req = makeReq();
    const res = makeRes();

    await listarProductos(req, res);

    expect(res.json).toHaveBeenCalledWith(mockProductos);
  });

  test("retorna 500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await listarProductos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listarSaldosResumen
// ═════════════════════════════════════════════════════════════════════════════

describe("listarSaldosResumen", () => {
  test("400 si falta conteo_grupo_id", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await listarSaldosResumen(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna resumen de saldos correctamente", async () => {
    const mockRows = [
      {
        id: 1,
        nombre: "P1",
        saldo_sistema: 100,
        conteo_total: 80,
        diferencia: 20,
      },
    ];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { conteo_grupo_id: "5" } });
    const res = makeRes();

    await listarSaldosResumen(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listarConteosDetalle
// ═════════════════════════════════════════════════════════════════════════════

describe("listarConteosDetalle", () => {
  test("400 si faltan parámetros", async () => {
    const req = makeReq({ query: { conteo_grupo_id: "5" } }); // falta producto_id
    const res = makeRes();

    await listarConteosDetalle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna detalle de conteos", async () => {
    const mockRows = [{ id: 10, cantidad: 5, estado: "VIGENTE" }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { conteo_grupo_id: "5", producto_id: "1" } });
    const res = makeRes();

    await listarConteosDetalle(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// anularConteo
// ═════════════════════════════════════════════════════════════════════════════

describe("anularConteo", () => {
  test("400 si falta motivo", async () => {
    const req = makeReq({
      params: { id: "1" },
      body: { motivo: "" },
      query: { conteo_grupo_id: "5" },
    });
    const res = makeRes();

    await anularConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("motivo") }),
    );
  });

  test("400 si falta conteo_grupo_id", async () => {
    const req = makeReq({
      params: { id: "1" },
      body: { motivo: "Error de ingreso" },
      query: {},
    });
    const res = makeRes();

    await anularConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("404 si el conteo no existe o ya fue anulado", async () => {
    // Sin QueryTypes, Sequelize devuelve [rows, metadata]
    // metadata en MySQL tiene affectedRows = 0
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 0 }]);

    const req = makeReq({
      params: { id: "99" },
      body: { motivo: "Error de ingreso" },
      query: { conteo_grupo_id: "5" },
    });
    const res = makeRes();

    await anularConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("anula correctamente y retorna 200", async () => {
    // FIX CLAVE: el controlador hace const [, meta] = await db.sequelize.query(...)
    // meta es el SEGUNDO elemento del array → { affectedRows: 1 }
    // Sequelize con MySQL devuelve el objeto de resultado como segundo elemento
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const req = makeReq({
      params: { id: "1" },
      body: { motivo: "Error de ingreso" },
      query: { conteo_grupo_id: "5" },
    });
    const res = makeRes();

    await anularConteo(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: "Conteo anulado correctamente",
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getConteosAnulados
// ═════════════════════════════════════════════════════════════════════════════

describe("getConteosAnulados", () => {
  test("400 si falta conteo_grupo_id", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await getConteosAnulados(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna conteos anulados", async () => {
    const mockRows = [{ id: 1, producto: "P1", motivo_anulacion: "Error" }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { conteo_grupo_id: "5" } });
    const res = makeRes();

    await getConteosAnulados(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// conteos_stats
// ═════════════════════════════════════════════════════════════════════════════

describe("conteos_stats", () => {
  test("400 si falta conteo_grupo_id", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await conteos_stats(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna stats correctamente", async () => {
    db.query.mockResolvedValueOnce([
      { total_registros: 10, total_cantidad: 250 },
    ]);

    const req = makeReq({ query: { conteo_grupo_id: "5" } });
    const res = makeRes();

    await conteos_stats(req, res);

    expect(res.json).toHaveBeenCalledWith({
      total_registros: 10,
      total_cantidad: 250,
    });
  });

  test("retorna valores en 0 si no hay registros", async () => {
    db.query.mockResolvedValueOnce([undefined]);

    const req = makeReq({ query: { conteo_grupo_id: "5" } });
    const res = makeRes();

    await conteos_stats(req, res);

    expect(res.json).toHaveBeenCalledWith({
      total_registros: 0,
      total_cantidad: 0,
    });
  });
});
