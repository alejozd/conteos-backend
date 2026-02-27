// src/controllers/test/bodegas.controller.test.js
// Ejecutar con: npx jest bodegas.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));

const db = require("../../config/database");
const { listar } = require("../bodegas.controller");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  user: { id: 1, empresa_id: 1 },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// listar
// ═════════════════════════════════════════════════════════════════════════════

describe("bodegas.listar", () => {
  test("retorna lista de bodegas de la empresa", async () => {
    const mockBodegas = [
      { id: 1, nombre: "Bodega Central" },
      { id: 2, nombre: "Bodega Norte" },
    ];
    db.query.mockResolvedValueOnce(mockBodegas);

    const req = makeReq();
    const res = makeRes();

    await listar(req, res);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT"),
      [1],
    );
    expect(res.json).toHaveBeenCalledWith(mockBodegas);
  });

  test("filtra por empresa_id del usuario autenticado", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ user: { id: 5, empresa_id: 7 } });
    const res = makeRes();

    await listar(req, res);

    const params = db.query.mock.calls[0][1];
    expect(params).toContain(7);
  });

  test("retorna array vacío si la empresa no tiene bodegas", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await listar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error al cargar bodegas" }),
    );
  });
});
