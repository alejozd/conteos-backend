// src/controllers/test/productos.controller.test.js
// Ejecutar con: npx jest productos.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));

const db = require("../../config/database");
const { buscar } = require("../productos.controller");

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
// buscar
// ═════════════════════════════════════════════════════════════════════════════

describe("buscar", () => {
  // ── Validación de texto mínimo (sin tocar DB) ─────────────────────────────

  test("retorna [] sin query si texto está vacío", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await buscar(req, res);

    expect(db.query).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("retorna [] sin query si texto tiene 1 carácter", async () => {
    const req = makeReq({ query: { texto: "a" } });
    const res = makeRes();

    await buscar(req, res);

    expect(db.query).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("retorna [] sin query si texto es solo espacios", async () => {
    const req = makeReq({ query: { texto: "  " } });
    const res = makeRes();

    await buscar(req, res);

    expect(db.query).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("ejecuta query si texto tiene 2 o más caracteres", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { texto: "ab" } });
    const res = makeRes();

    await buscar(req, res);

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  // ── Búsqueda y resultados ─────────────────────────────────────────────────

  test("busca en mayúsculas con LIKE envolvente", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { texto: "arroz" } });
    const res = makeRes();

    await buscar(req, res);

    const [, params] = db.query.mock.calls[0];
    expect(params[1]).toBe("%ARROZ%");
    expect(params[2]).toBe("%ARROZ%");
  });

  test("filtra por empresa_id del usuario autenticado", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({
      query: { texto: "leche" },
      user: { id: 5, empresa_id: 7 },
    });
    const res = makeRes();

    await buscar(req, res);

    const [, params] = db.query.mock.calls[0];
    expect(params[0]).toBe(7);
  });

  test("retorna productos encontrados con saldo_sistema", async () => {
    const mockProductos = [
      {
        id: 1,
        referencia: "REF-001",
        nombre: "Arroz 500g",
        saldo_sistema: 100,
      },
      { id: 2, referencia: "REF-002", nombre: "Arroz 1kg", saldo_sistema: 0 },
    ];
    db.query.mockResolvedValueOnce(mockProductos);

    const req = makeReq({ query: { texto: "arroz" } });
    const res = makeRes();

    await buscar(req, res);

    expect(res.json).toHaveBeenCalledWith(mockProductos);
  });

  test("retorna [] si no hay productos que coincidan", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { texto: "xyzabc" } });
    const res = makeRes();

    await buscar(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("hace trim del texto antes de buscar", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ query: { texto: "  leche  " } });
    const res = makeRes();

    await buscar(req, res);

    const [, params] = db.query.mock.calls[0];
    expect(params[1]).toBe("%LECHE%"); // sin espacios
  });

  // ── Manejo de errores ─────────────────────────────────────────────────────

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ query: { texto: "leche" } });
    const res = makeRes();

    await buscar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error en búsqueda" }),
    );
  });
});
