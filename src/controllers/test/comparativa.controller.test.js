// src/controllers/test/comparativa.controller.test.js
// Ejecutar con: npx jest comparativa.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({
  query: jest.fn(),
  sequelize: {
    query: jest.fn(),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

// sequelize también se importa directamente en el controlador
jest.mock("sequelize", () => ({
  QueryTypes: { SELECT: "SELECT" },
}));

const db = require("../../config/database");
const { getComparativa } = require("../comparativa.controller");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  query: {},
  user: { id: 1, empresa_id: 1 },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// getComparativa
// ═════════════════════════════════════════════════════════════════════════════

describe("getComparativa", () => {
  // ── Validaciones de entrada ───────────────────────────────────────────────

  test("400 si no se envían ids", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("seleccionar"),
      }),
    );
  });

  test("400 si todos los ids son inválidos (NaN)", async () => {
    const req = makeReq({ query: { ids: "abc,xyz" } });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("válidos") }),
    );
  });

  test("400 si los ids son cero o negativos", async () => {
    const req = makeReq({ query: { ids: "0,-1,-5" } });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("filtra NaN y procesa solo ids válidos mezclados", async () => {
    // "1,abc,2" → filtra "abc" → procesa [1, 2]
    db.sequelize.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { ids: "1,abc,2" } });
    const res = makeRes();

    await getComparativa(req, res);

    // Debe haber llegado a ejecutar la query (no retornó 400)
    expect(db.sequelize.query).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  // ── Query y respuesta ─────────────────────────────────────────────────────

  test("retorna comparativa correctamente con un id", async () => {
    const mockRows = [
      {
        id: 1,
        nombre: "Producto A",
        referencia: "REF-1",
        saldo_sistema: 100,
        c_1: 95,
      },
    ];
    db.sequelize.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { ids: "1" } });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("retorna comparativa correctamente con múltiples ids", async () => {
    const mockRows = [
      { id: 1, nombre: "Producto A", saldo_sistema: 100, c_1: 95, c_2: 90 },
      { id: 2, nombre: "Producto B", saldo_sistema: 50, c_1: 48, c_2: 47 },
    ];
    db.sequelize.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { ids: "1,2" } });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("genera columnas dinámicas correctas en el SQL", async () => {
    db.sequelize.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { ids: "3,7" } });
    const res = makeRes();

    await getComparativa(req, res);

    const sqlUsado = db.sequelize.query.mock.calls[0][0];
    expect(sqlUsado).toContain("conteo_grupo_id = 3");
    expect(sqlUsado).toContain("conteo_grupo_id = 7");
    expect(sqlUsado).toContain("AS c_3");
    expect(sqlUsado).toContain("AS c_7");
  });

  test("usa empresa_id del usuario en los replacements", async () => {
    db.sequelize.query.mockResolvedValueOnce([]);

    const req = makeReq({
      query: { ids: "1" },
      user: { id: 5, empresa_id: 99 },
    });
    const res = makeRes();

    await getComparativa(req, res);

    const options = db.sequelize.query.mock.calls[0][1];
    expect(options.replacements).toEqual(
      expect.objectContaining({ empresa_id: 99 }),
    );
  });

  test("retorna array vacío si no hay productos en los conteos", async () => {
    db.sequelize.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { ids: "1,2" } });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  // ── Manejo de errores ─────────────────────────────────────────────────────

  test("500 si falla la query", async () => {
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ query: { ids: "1,2" } });
    const res = makeRes();

    await getComparativa(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error interno del servidor" }),
    );
  });
});
