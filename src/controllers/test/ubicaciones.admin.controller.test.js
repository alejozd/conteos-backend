// src/controllers/test/ubicaciones.admin.controller.test.js
// Ejecutar con: npx jest ubicaciones.admin.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));

const db = require("../../config/database");
const {
  listar,
  crear,
  actualizar,
  eliminar,
} = require("../ubicaciones.admin.controller");

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
  query: {},
  user: { id: 1, empresa_id: 1 },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// listar
// ═════════════════════════════════════════════════════════════════════════════

describe("listar", () => {
  test("retorna todas las ubicaciones sin filtro de bodega", async () => {
    const mockRows = [
      { id: 1, nombre: "Pasillo A", bodega_id: 1 },
      { id: 2, nombre: "Pasillo B", bodega_id: 2 },
    ];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
    // Sin bodega_id, los params deben ser null
    const params = db.query.mock.calls[0][1];
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
  });

  test("filtra por bodega_id cuando se envía", async () => {
    const mockRows = [{ id: 1, nombre: "Pasillo A", bodega_id: 3 }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { bodega_id: "3" } });
    const res = makeRes();

    await listar(req, res);

    const params = db.query.mock.calls[0][1];
    expect(params[1]).toBe("3");
    expect(params[2]).toBe("3");
    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("retorna array vacío si no hay ubicaciones", async () => {
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
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// crear
// ═════════════════════════════════════════════════════════════════════════════

describe("crear", () => {
  test("400 si falta nombre", async () => {
    const req = makeReq({ body: { bodega_id: 1 } });
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

  test("crea ubicación correctamente y retorna 201", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ body: { nombre: "  Estante C3  ", bodega_id: 2 } });
    const res = makeRes();

    await crear(req, res);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT"), [
      "Estante C3",
      2,
      1,
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Ubicación creada correctamente" }),
    );
  });

  test("bodega_id null si no se envía", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ body: { nombre: "Pasillo D" } });
    const res = makeRes();

    await crear(req, res);

    const params = db.query.mock.calls[0][1];
    expect(params[1]).toBeNull();
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ body: { nombre: "Pasillo A" } });
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
    const req = makeReq({ params: { id: "1" }, body: { bodega_id: 1 } });
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

  test("404 si la ubicación no existe o no pertenece a la empresa", async () => {
    db.query.mockResolvedValueOnce([]); // SELECT → vacío

    const req = makeReq({ params: { id: "99" }, body: { nombre: "Nueva" } });
    const res = makeRes();

    await actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Ubicación no encontrada" }),
    );
  });

  test("actualiza ubicación correctamente con trim del nombre", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 1 }]) // SELECT → existe
      .mockResolvedValueOnce([]); // UPDATE OK

    const req = makeReq({
      params: { id: "1" },
      body: { nombre: "  Pasillo Actualizado  ", bodega_id: 3 },
    });
    const res = makeRes();

    await actualizar(req, res);

    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE"),
      ["Pasillo Actualizado", 3, "1", 1],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Ubicación actualizada correctamente",
      }),
    );
  });

  test("bodega_id null si no se envía en update", async () => {
    db.query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([]);

    const req = makeReq({ params: { id: "1" }, body: { nombre: "Pasillo A" } });
    const res = makeRes();

    await actualizar(req, res);

    const params = db.query.mock.calls[1][1];
    expect(params[1]).toBeNull();
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "1" }, body: { nombre: "Test" } });
    const res = makeRes();

    await actualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// eliminar
// ═════════════════════════════════════════════════════════════════════════════

describe("eliminar", () => {
  test("400 si la ubicación tiene conteos vigentes", async () => {
    db.query.mockResolvedValueOnce([{ total: 3 }]);

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await eliminar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("conteos asociados"),
      }),
    );
  });

  test("elimina ubicación correctamente si no tiene conteos", async () => {
    db.query
      .mockResolvedValueOnce([{ total: 0 }]) // COUNT → sin conteos
      .mockResolvedValueOnce([]); // DELETE OK

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await eliminar(req, res);

    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("DELETE"),
      ["1", 1],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Ubicación eliminada correctamente" }),
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
