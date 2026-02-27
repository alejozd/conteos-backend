// src/controllers/test/admin.usuarios.controller.test.js
// Ejecutar con: npx jest admin.usuarios.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({ query: jest.fn() }));
jest.mock("bcryptjs");

const db = require("../../config/database");
const bcrypt = require("bcryptjs");

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require("../admin.usuarios.controller");

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
  user: { id: 99, role: "admin", empresa_id: 1 },
  ...overrides,
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// listarUsuarios
// ═════════════════════════════════════════════════════════════════════════════

describe("listarUsuarios", () => {
  test("superadmin recibe todos los usuarios sin filtro de empresa", async () => {
    const mockRows = [
      { id: 1, username: "alejo", role: "superadmin", empresa_id: null },
      { id: 2, username: "carlos", role: "admin", empresa_id: 1 },
    ];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({
      user: { id: 1, role: "superadmin", empresa_id: null },
    });
    const res = makeRes();

    await listarUsuarios(req, res);

    // La query NO debe incluir WHERE empresa_id
    const sqlUsado = db.query.mock.calls[0][0];
    expect(sqlUsado).not.toContain("WHERE");
    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("admin solo recibe usuarios de su empresa", async () => {
    const mockRows = [{ id: 2, username: "carlos", empresa_id: 1 }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ user: { id: 99, role: "admin", empresa_id: 1 } });
    const res = makeRes();

    await listarUsuarios(req, res);

    const [sqlUsado, params] = db.query.mock.calls[0];
    expect(sqlUsado).toContain("WHERE");
    expect(params).toContain(1); // empresa_id = 1
    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("retorna 500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await listarUsuarios(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// crearUsuario
// ═════════════════════════════════════════════════════════════════════════════

describe("crearUsuario", () => {
  test("400 si falta username", async () => {
    const req = makeReq({ body: { password: "123", role: "user" } });
    const res = makeRes();

    await crearUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("obligatorios"),
      }),
    );
  });

  test("400 si falta password", async () => {
    const req = makeReq({ body: { username: "juan", role: "user" } });
    const res = makeRes();

    await crearUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si falta role", async () => {
    const req = makeReq({ body: { username: "juan", password: "123" } });
    const res = makeRes();

    await crearUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("409 si el username ya existe en la empresa", async () => {
    db.query.mockResolvedValueOnce([{ id: 5 }]); // ya existe

    const req = makeReq({
      body: { username: "juan", password: "123", role: "user" },
    });
    const res = makeRes();

    await crearUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("ya está en uso"),
      }),
    );
  });

  test("crea usuario correctamente con empresa heredada del admin", async () => {
    db.query
      .mockResolvedValueOnce([]) // SELECT → no existe
      .mockResolvedValueOnce([]); // INSERT OK

    bcrypt.hash.mockResolvedValueOnce("HASHED_DUMMY_PASSWORD");

    const req = makeReq({
      user: { id: 99, role: "admin", empresa_id: 1 },
      body: { username: "nuevo", password: "123", role: "user" },
    });
    const res = makeRes();

    await crearUsuario(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("123", 10);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Usuario creado correctamente" }),
    );
  });

  test("superadmin puede asignar empresa_id distinta", async () => {
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    bcrypt.hash.mockResolvedValueOnce("HASHED_DUMMY_PASSWORD");

    const req = makeReq({
      user: { id: 1, role: "superadmin", empresa_id: null },
      body: {
        username: "nuevo",
        password: "123",
        role: "admin",
        empresa_id: 5,
      },
    });
    const res = makeRes();

    await crearUsuario(req, res);

    // El INSERT debe usar empresa_id = 5, no null
    const insertCall = db.query.mock.calls[1];
    expect(insertCall[1]).toContain(5);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("retorna 500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({
      body: { username: "nuevo", password: "123", role: "user" },
    });
    const res = makeRes();

    await crearUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// actualizarUsuario
// ═════════════════════════════════════════════════════════════════════════════

describe("actualizarUsuario", () => {
  test("404 si el usuario no existe", async () => {
    db.query.mockResolvedValueOnce([]); // SELECT → vacío

    const req = makeReq({ params: { id: "99" }, body: { role: "admin" } });
    const res = makeRes();

    await actualizarUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("403 si intenta modificar al usuario protegido 'alejo'", async () => {
    db.query.mockResolvedValueOnce([{ id: 1, username: "alejo" }]);

    const req = makeReq({ params: { id: "1" }, body: { role: "user" } });
    const res = makeRes();

    await actualizarUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("no puede ser modificado"),
      }),
    );
  });

  test("400 si no hay campos para actualizar", async () => {
    db.query.mockResolvedValueOnce([{ id: 2, username: "carlos" }]);

    const req = makeReq({ params: { id: "2" }, body: {} });
    const res = makeRes();

    await actualizarUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "No hay datos para actualizar" }),
    );
  });

  test("actualiza role correctamente", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 2, username: "carlos" }]) // SELECT
      .mockResolvedValueOnce([]); // UPDATE

    const req = makeReq({ params: { id: "2" }, body: { role: "admin" } });
    const res = makeRes();

    await actualizarUsuario(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Usuario actualizado correctamente" }),
    );
  });

  test("actualiza password hasheando correctamente", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 2, username: "carlos" }])
      .mockResolvedValueOnce([]);

    bcrypt.hash.mockResolvedValueOnce("nuevo_hash");

    const req = makeReq({
      params: { id: "2" },
      body: { password: "nueva123" },
    });
    const res = makeRes();

    await actualizarUsuario(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("nueva123", 10);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Usuario actualizado correctamente" }),
    );
  });

  test("retorna 500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "2" }, body: { role: "user" } });
    const res = makeRes();

    await actualizarUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// cambiarEstadoUsuario
// ═════════════════════════════════════════════════════════════════════════════

describe("cambiarEstadoUsuario", () => {
  test("400 si activo no viene en el body", async () => {
    const req = makeReq({ params: { id: "5" }, body: {} });
    const res = makeRes();

    await cambiarEstadoUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("activo") }),
    );
  });

  test("403 si el usuario intenta desactivarse a sí mismo", async () => {
    const req = makeReq({
      params: { id: "99" },
      body: { activo: 0 },
      user: { id: 99, role: "admin", empresa_id: 1 },
    });
    const res = makeRes();

    await cambiarEstadoUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("propio usuario"),
      }),
    );
  });

  test("403 si intenta modificar al usuario con id 1", async () => {
    const req = makeReq({
      params: { id: "1" },
      body: { activo: 0 },
      user: { id: 99, role: "admin", empresa_id: 1 },
    });
    const res = makeRes();

    await cambiarEstadoUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("no puede ser desactivado"),
      }),
    );
  });

  test("cambia estado correctamente a inactivo", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({
      params: { id: "5" },
      body: { activo: 0 },
      user: { id: 99, role: "admin", empresa_id: 1 },
    });
    const res = makeRes();

    await cambiarEstadoUsuario(req, res);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE usuarios SET activo"),
      [0, "5"],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Estado actualizado correctamente" }),
    );
  });

  test("cambia estado correctamente a activo", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({
      params: { id: "5" },
      body: { activo: 1 },
    });
    const res = makeRes();

    await cambiarEstadoUsuario(req, res);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE usuarios SET activo"),
      [1, "5"],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Estado actualizado correctamente" }),
    );
  });

  test("retorna 500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({
      params: { id: "5" },
      body: { activo: 0 },
    });
    const res = makeRes();

    await cambiarEstadoUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
