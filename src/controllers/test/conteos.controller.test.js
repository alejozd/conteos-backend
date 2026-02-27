// src/controllers/test/conteos.controller.test.js
// Ejecutar con: npx jest conteos.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({
  query: jest.fn(),
  sequelize: {
    query: jest.fn(),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

const db = require("../../config/database");
const { guardar, listarActivos } = require("../conteos.controller");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  body: {},
  query: {},
  user: { id: 1, empresa_id: 1, username: "testuser" },
  app: { get: jest.fn().mockReturnValue(null) },
  ...overrides,
});

const bodyValido = {
  id: 1,
  ubicacion_id: 10,
  cantidad: 5,
  conteo_grupo_id: 2,
};

const grupoActivo = [{ activo: 1, descripcion: "Conteo Enero" }];
const grupoCerrado = [{ activo: 0, descripcion: "Conteo Enero" }];
const productoMock = [{ id: 1, nombre: "Producto A", referencia: "REF-001" }];

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// guardar
// ═════════════════════════════════════════════════════════════════════════════

describe("guardar", () => {
  // ── Validaciones de entrada ───────────────────────────────────────────────

  test("400 si falta id del producto", async () => {
    const req = makeReq({
      body: { ubicacion_id: 10, cantidad: 5, conteo_grupo_id: 2 },
    });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Faltan datos requeridos" }),
    );
  });

  test("400 si falta ubicacion_id", async () => {
    const req = makeReq({ body: { id: 1, cantidad: 5, conteo_grupo_id: 2 } });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si falta conteo_grupo_id", async () => {
    const req = makeReq({ body: { id: 1, ubicacion_id: 10, cantidad: 5 } });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si cantidad es negativa", async () => {
    const req = makeReq({ body: { ...bodyValido, cantidad: -1 } });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Cantidad inválida" }),
    );
  });

  test("400 si cantidad no es número", async () => {
    const req = makeReq({ body: { ...bodyValido, cantidad: "abc" } });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("cantidad 0 es válida", async () => {
    db.query
      .mockResolvedValueOnce(grupoActivo)
      .mockResolvedValueOnce(productoMock)
      .mockResolvedValueOnce([]);

    const req = makeReq({ body: { ...bodyValido, cantidad: 0 } });
    const res = makeRes();

    await guardar(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ cantidad: 0 }),
    );
  });

  // ── Validaciones de negocio ───────────────────────────────────────────────

  test("404 si el grupo de conteo no existe", async () => {
    db.query.mockResolvedValueOnce([]); // grupo no encontrado

    const req = makeReq({ body: bodyValido });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("grupo") }),
    );
  });

  test("403 si el grupo de conteo está cerrado", async () => {
    db.query.mockResolvedValueOnce(grupoCerrado);

    const req = makeReq({ body: bodyValido });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Conteo Enero"),
      }),
    );
  });

  test("404 si el producto no existe en la empresa", async () => {
    db.query.mockResolvedValueOnce(grupoActivo).mockResolvedValueOnce([]); // producto no encontrado

    const req = makeReq({ body: bodyValido });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Producto no encontrado" }),
    );
  });

  // ── Flujo exitoso ─────────────────────────────────────────────────────────

  test("guarda conteo correctamente y retorna datos del producto", async () => {
    db.query
      .mockResolvedValueOnce(grupoActivo)
      .mockResolvedValueOnce(productoMock)
      .mockResolvedValueOnce([]); // INSERT

    const req = makeReq({ body: bodyValido });
    const res = makeRes();

    await guardar(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Conteo guardado correctamente",
        producto: expect.objectContaining({
          nombre: "Producto A",
          referencia: "REF-001",
        }),
        cantidad: 5,
      }),
    );
  });

  test("emite evento socket si io está disponible", async () => {
    const mockEmit = jest.fn();
    db.query
      .mockResolvedValueOnce(grupoActivo)
      .mockResolvedValueOnce(productoMock)
      .mockResolvedValueOnce([]);

    const req = makeReq({
      body: bodyValido,
      app: { get: jest.fn().mockReturnValue({ emit: mockEmit }) },
    });
    const res = makeRes();

    await guardar(req, res);

    expect(mockEmit).toHaveBeenCalledWith(
      "nuevo-conteo",
      expect.objectContaining({
        nombre: "Producto A",
        referencia: "REF-001",
        cantidad: 5,
        usuario: "testuser",
      }),
    );
  });

  test("NO emite socket si io no está disponible", async () => {
    db.query
      .mockResolvedValueOnce(grupoActivo)
      .mockResolvedValueOnce(productoMock)
      .mockResolvedValueOnce([]);

    const req = makeReq({
      body: bodyValido,
      app: { get: jest.fn().mockReturnValue(null) },
    });
    const res = makeRes();

    await guardar(req, res);

    // Si io es null no debe lanzar error — solo retorna correctamente
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Conteo guardado correctamente" }),
    );
  });

  test("producto sin referencia usa string vacío en el socket", async () => {
    const mockEmit = jest.fn();
    const productoSinRef = [{ id: 1, nombre: "Producto B", referencia: null }];

    db.query
      .mockResolvedValueOnce(grupoActivo)
      .mockResolvedValueOnce(productoSinRef)
      .mockResolvedValueOnce([]);

    const req = makeReq({
      body: bodyValido,
      app: { get: jest.fn().mockReturnValue({ emit: mockEmit }) },
    });
    const res = makeRes();

    await guardar(req, res);

    expect(mockEmit).toHaveBeenCalledWith(
      "nuevo-conteo",
      expect.objectContaining({ referencia: "" }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        producto: expect.objectContaining({ referencia: "-" }),
      }),
    );
  });

  // ── Manejo de errores ─────────────────────────────────────────────────────

  test("500 si falla la query del grupo", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ body: bodyValido });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("500 si falla el INSERT", async () => {
    db.query
      .mockResolvedValueOnce(grupoActivo)
      .mockResolvedValueOnce(productoMock)
      .mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ body: bodyValido });
    const res = makeRes();

    await guardar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listarActivos
// ═════════════════════════════════════════════════════════════════════════════

describe("listarActivos", () => {
  test("retorna grupos de conteo activos", async () => {
    const mockGrupos = [
      { id: 1, fecha: "2024-01-15", descripcion: "Conteo Enero", activo: 1 },
      { id: 2, fecha: "2024-02-10", descripcion: "Conteo Febrero", activo: 1 },
    ];
    db.query.mockResolvedValueOnce(mockGrupos);

    const req = makeReq();
    const res = makeRes();

    await listarActivos(req, res);

    expect(res.json).toHaveBeenCalledWith(mockGrupos);
  });

  test("filtra por empresa_id del usuario", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ user: { id: 5, empresa_id: 7, username: "user" } });
    const res = makeRes();

    await listarActivos(req, res);

    const params = db.query.mock.calls[0][1];
    expect(params).toContain(7);
  });

  test("retorna array vacío si no hay grupos activos", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await listarActivos(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await listarActivos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error al listar grupos activos" }),
    );
  });
});
