// src/controllers/test/ubicaciones.controller.test.js
// Ejecutar con: npx jest ubicaciones.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));

const db = require("../../config/database");
const { listarPorBodega } = require("../ubicaciones.controller");

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
// listarPorBodega
// ═════════════════════════════════════════════════════════════════════════════

describe("listarPorBodega", () => {
  test("400 si falta bodegaId", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await listarPorBodega(req, res);

    expect(db.query).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "bodegaId es obligatorio" }),
    );
  });

  test("retorna ubicaciones de la bodega solicitada", async () => {
    const mockUbicaciones = [
      { id: 1, nombre: "Estante A1" },
      { id: 2, nombre: "Estante A2" },
    ];
    db.query.mockResolvedValueOnce(mockUbicaciones);

    const req = makeReq({ query: { bodegaId: "3" } });
    const res = makeRes();

    await listarPorBodega(req, res);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("bodega_id"),
      [1, "3"],
    );
    expect(res.json).toHaveBeenCalledWith(mockUbicaciones);
  });

  test("filtra por empresa_id del usuario autenticado", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({
      query: { bodegaId: "5" },
      user: { id: 9, empresa_id: 7 },
    });
    const res = makeRes();

    await listarPorBodega(req, res);

    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBe(7); // empresa_id
    expect(params[1]).toBe("5"); // bodegaId
  });

  test("retorna array vacío si la bodega no tiene ubicaciones", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { bodegaId: "99" } });
    const res = makeRes();

    await listarPorBodega(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ query: { bodegaId: "3" } });
    const res = makeRes();

    await listarPorBodega(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error al cargar ubicaciones" }),
    );
  });
});
