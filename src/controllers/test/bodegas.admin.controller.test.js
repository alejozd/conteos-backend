// src/controllers/test/bodegas.admin.controller.test.js
// Ejecutar con: npx jest bodegas.admin.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));

const db = require("../../config/database");

const {
  listar,
  crear,
  actualizar,
  eliminar,
} = require("../bodegas.admin.controller");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  params: {},
  body: {},
  user: { id: 1, empresa_id: 1 },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// listar
// ═════════════════════════════════════════════════════════════════════════════

describe("listar", () => {
  test("retorna lista de bodegas de la empresa", async () => {
    const mockBodegas = [
      { id: 1, nombre: "Bodega Central" },
      { id: 2, nombre: "Bodega Norte" },
    ];
    db.query.mockResolvedValueOnce(mockBodegas);

    const req = makeReq();
    const res = makeRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(mockBodegas);
  });

  test("retorna array vacío si no hay bodegas", async () => {
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
      expect.objectContaining({ message: expect.stringContaining("bodegas") }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// crear
// ═════════════════════════════════════════════════════════════════════════════

describe("crear", () => {
  test("400 si falta nombre", async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();

    await crear(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El nombre es obligatorio" }),
    );
  });

  test("400 si nombre es solo espacios", async () => {
    const req = makeReq({ body: { nombre: "   " } });
    const res = makeRes();

    await crear(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("crea bodega correctamente y retorna 201", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ body: { nombre: "  Bodega Sur  " } });
    const res = makeRes();

    await crear(req, res);

    // Verifica que se hizo trim del nombre
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT"), [
      "Bodega Sur",
      1,
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Bodega creada correctamente" }),
    );
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ body: { nombre: "Bodega Nueva" } });
    const res = makeRes();

    await crear(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// actualizar
// ═════════════════════════════════════════════════════════════════════════════

describe("actualizar", () => {
  test("400 si falta nombre", async () => {
    const req = makeReq({ params: { id: "1" }, body: {} });
    const res = makeRes();

    await actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si nombre es solo espacios", async () => {
    const req = makeReq({ params: { id: "1" }, body: { nombre: "   " } });
    const res = makeRes();

    await actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("404 si la bodega no existe o no pertenece a la empresa", async () => {
    db.query.mockResolvedValueOnce([]); // SELECT → vacío

    const req = makeReq({ params: { id: "99" }, body: { nombre: "Nueva" } });
    const res = makeRes();

    await actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Bodega no encontrada" }),
    );
  });

  test("actualiza bodega correctamente con trim del nombre", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 1 }]) // SELECT → existe
      .mockResolvedValueOnce([]); // UPDATE OK

    const req = makeReq({
      params: { id: "1" },
      body: { nombre: "  Bodega Central  " },
    });
    const res = makeRes();

    await actualizar(req, res);

    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE"),
      ["Bodega Central", "1", 1],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Bodega actualizada correctamente" }),
    );
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "1" }, body: { nombre: "Nueva" } });
    const res = makeRes();

    await actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// eliminar
// ═════════════════════════════════════════════════════════════════════════════

describe("eliminar", () => {
  test("400 si la bodega tiene ubicaciones asociadas", async () => {
    db.query.mockResolvedValueOnce([{ total: 3 }]); // COUNT → tiene ubicaciones

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await eliminar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("ubicaciones asociadas"),
      }),
    );
  });

  test("elimina bodega correctamente si no tiene ubicaciones", async () => {
    db.query
      .mockResolvedValueOnce([{ total: 0 }]) // COUNT → sin ubicaciones
      .mockResolvedValueOnce([]); // DELETE OK

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await eliminar(req, res);

    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("DELETE"),
      ["1", 1],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Bodega eliminada correctamente" }),
    );
  });

  test("500 si falla la query del COUNT", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await eliminar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("500 si falla la query del DELETE", async () => {
    db.query
      .mockResolvedValueOnce([{ total: 0 }])
      .mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await eliminar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
