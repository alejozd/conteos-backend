// src/controllers/test/auth.controller.test.js

// ─── Mocks ANTES de cualquier import ─────────────────────────────────────────
jest.mock("../../config/database");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

// El módulo lanza error si JWT_SECRET no existe, lo seteamos antes de importar
process.env.JWT_SECRET = "DUMMY_FOR_TESTS";
process.env.JWT_EXPIRES_IN = "8h";

const db = require("../../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { login } = require("../auth.controller");

// ─── Factory helpers ──────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body = {}) => ({ body });

const usuarioActivo = {
  id: 1,
  username: "admin",
  password: "hashed_password",
  role: "admin",
  activo: 1,
  empresa_id: 10,
  empresa_nombre: "Empresa Test",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.controller - login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Validación de body ────────────────────────────────────────────────────

  test("400 si falta username", async () => {
    const req = mockReq({ password: "123" });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Username y password son requeridos",
    });
  });

  test("400 si falta password", async () => {
    const req = mockReq({ username: "admin" });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Username y password son requeridos",
    });
  });

  test("400 si body está vacío", async () => {
    const req = mockReq({});
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ── Usuario no encontrado ─────────────────────────────────────────────────

  test("401 si el usuario no existe en DB", async () => {
    db.query.mockResolvedValue([]);

    const req = mockReq({ username: "noexiste", password: "123" });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario o contraseña incorrectos",
    });
  });

  // ── Usuario inactivo ──────────────────────────────────────────────────────

  test("403 si el usuario existe pero está inactivo", async () => {
    db.query.mockResolvedValue([{ ...usuarioActivo, activo: 0 }]);

    const req = mockReq({ username: "admin", password: "123" });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario inactivo. Contacte al administrador.",
    });
  });

  // ── Password incorrecto ───────────────────────────────────────────────────

  test("401 si el password es incorrecto", async () => {
    db.query.mockResolvedValue([usuarioActivo]);
    bcrypt.compare.mockResolvedValue(false);

    const req = mockReq({ username: "admin", password: "wrong" });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario o contraseña incorrectos",
    });
  });

  // ── Login exitoso ─────────────────────────────────────────────────────────

  test("200 y retorna token + user en login exitoso", async () => {
    db.query.mockResolvedValue([usuarioActivo]);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("mocked_token");

    const req = mockReq({ username: "admin", password: "correcta" });
    const res = mockRes();

    await login(req, res);

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        id: usuarioActivo.id,
        username: usuarioActivo.username,
        role: usuarioActivo.role,
        empresa_id: usuarioActivo.empresa_id,
        empresa_nombre: usuarioActivo.empresa_nombre,
      },
      "test_secret",
      { expiresIn: "8h" },
    );

    expect(res.json).toHaveBeenCalledWith({
      token: "mocked_token",
      user: {
        id: 1,
        username: "admin",
        role: "admin",
        empresa_id: 10,
        empresa_nombre: "Empresa Test",
      },
    });
  });

  // ── Error de base de datos ────────────────────────────────────────────────

  test("500 si la DB lanza un error inesperado", async () => {
    db.query.mockRejectedValue(new Error("DB connection lost"));

    const req = mockReq({ username: "admin", password: "123" });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Error del servidor" });
  });

  // ── No filtra info en errores ─────────────────────────────────────────────

  test("el mensaje de error 500 no expone detalles internos", async () => {
    db.query.mockRejectedValue(new Error("Table 'usuarios' doesn't exist"));

    const req = mockReq({ username: "admin", password: "123" });
    const res = mockRes();

    await login(req, res);

    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta.message).not.toContain("Table");
    expect(respuesta.message).not.toContain("usuarios");
  });
});
