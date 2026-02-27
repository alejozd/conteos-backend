// src/controllers/test/empresas.controller.test.js
// Ejecutar con: npx jest empresas.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));

const db = require("../../config/database");
const {
  getEmpresas,
  createEmpresa,
  updateEmpresa,
} = require("../empresas.controller");

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
// getEmpresas
// ═════════════════════════════════════════════════════════════════════════════

describe("getEmpresas", () => {
  test("retorna lista de empresas", async () => {
    const mockEmpresas = [
      { id: 1, nombre: "Empresa A", nit: "123", descripcion: null, activo: 1 },
      {
        id: 2,
        nombre: "Empresa B",
        nit: "456",
        descripcion: "Desc",
        activo: 1,
      },
    ];
    db.query.mockResolvedValueOnce(mockEmpresas);

    const req = makeReq();
    const res = makeRes();

    await getEmpresas(req, res);

    expect(res.json).toHaveBeenCalledWith(mockEmpresas);
  });

  test("no usa SELECT * — query con columnas explícitas", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await getEmpresas(req, res);

    const sql = db.query.mock.calls[0][0];
    expect(sql).not.toContain("SELECT *");
    expect(sql).toContain("id");
    expect(sql).toContain("nombre");
  });

  test("retorna array vacío si no hay empresas", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await getEmpresas(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("500 con mensaje genérico si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB password exposed error"));

    const req = makeReq();
    const res = makeRes();

    await getEmpresas(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    // FIX clave: no debe exponer el mensaje interno del error
    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta.message).not.toContain("DB password exposed error");
    expect(respuesta.message).toBe("Error al obtener empresas");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createEmpresa
// ═════════════════════════════════════════════════════════════════════════════

describe("createEmpresa", () => {
  test("400 si falta nombre", async () => {
    const req = makeReq({ body: { nit: "123" } });
    const res = makeRes();

    await createEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El nombre es obligatorio" }),
    );
  });

  test("400 si nombre es solo espacios", async () => {
    const req = makeReq({ body: { nombre: "   ", nit: "123" } });
    const res = makeRes();

    await createEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si falta nit", async () => {
    const req = makeReq({ body: { nombre: "Empresa A" } });
    const res = makeRes();

    await createEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El NIT es obligatorio" }),
    );
  });

  test("crea empresa correctamente y retorna 201", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({
      body: { nombre: "  Empresa A  ", nit: "  123-4  ", descripcion: "Test" },
    });
    const res = makeRes();

    await createEmpresa(req, res);

    // Verifica trim de nombre y nit
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT"), [
      "Empresa A",
      "123-4",
      "Test",
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Empresa creada con éxito" }),
    );
  });

  test("descripcion null si no se envía", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ body: { nombre: "Empresa B", nit: "789" } });
    const res = makeRes();

    await createEmpresa(req, res);

    const params = db.query.mock.calls[0][1];
    expect(params[2]).toBeNull(); // descripcion → null
  });

  test("500 con mensaje genérico si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("Duplicate entry 'nit'"));

    const req = makeReq({ body: { nombre: "Empresa A", nit: "123" } });
    const res = makeRes();

    await createEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta.message).not.toContain("Duplicate entry");
    expect(respuesta.message).toBe("Error al crear la empresa");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// updateEmpresa
// ═════════════════════════════════════════════════════════════════════════════

describe("updateEmpresa", () => {
  test("400 si falta nombre", async () => {
    const req = makeReq({
      params: { id: "1" },
      body: { nit: "123", activo: 1 },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si falta nit", async () => {
    const req = makeReq({
      params: { id: "1" },
      body: { nombre: "Empresa A", activo: 1 },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si falta activo", async () => {
    const req = makeReq({
      params: { id: "1" },
      body: { nombre: "Empresa A", nit: "123" },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El campo activo es obligatorio" }),
    );
  });

  test("404 si la empresa no existe", async () => {
    db.query.mockResolvedValueOnce([]); // SELECT → vacío

    const req = makeReq({
      params: { id: "99" },
      body: { nombre: "Test", nit: "000", activo: 1 },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Empresa no encontrada" }),
    );
  });

  test("actualiza empresa correctamente con trim", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 1 }]) // SELECT → existe
      .mockResolvedValueOnce([]); // UPDATE OK

    const req = makeReq({
      params: { id: "1" },
      body: {
        nombre: "  Empresa Actualizada  ",
        nit: "  999  ",
        descripcion: "Desc",
        activo: 0,
      },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE"),
      ["Empresa Actualizada", "999", "Desc", 0, "1"],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Empresa actualizada correctamente" }),
    );
  });

  test("descripcion null si no se envía en update", async () => {
    db.query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([]);

    const req = makeReq({
      params: { id: "1" },
      body: { nombre: "Empresa A", nit: "123", activo: 1 },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    const params = db.query.mock.calls[1][1];
    expect(params[2]).toBeNull(); // descripcion → null
  });

  test("500 con mensaje genérico si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("Connection lost"));

    const req = makeReq({
      params: { id: "1" },
      body: { nombre: "Test", nit: "123", activo: 1 },
    });
    const res = makeRes();

    await updateEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta.message).not.toContain("Connection lost");
    expect(respuesta.message).toBe("Error al actualizar la empresa");
  });
});
