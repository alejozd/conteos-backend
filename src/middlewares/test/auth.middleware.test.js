// src/middlewares/test/auth.middleware.test.js
// Ejecutar con: npx jest auth.middleware.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("jsonwebtoken");

const jwt = require("jsonwebtoken");

// FIX: JWT_SECRET debe definirse en el top-level, ANTES del require.
// beforeAll corre demasiado tarde — los require top-level ya se ejecutaron.
process.env.JWT_SECRET = "test-secret";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  headers: {},
  originalUrl: "/api/conteos",
  path: "/api/conteos",
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// Ahora el require es seguro — JWT_SECRET ya está definido
const { verificarToken, esAdmin, esSuperAdmin } = require("../auth.middleware");

// ═════════════════════════════════════════════════════════════════════════════
// verificarToken
// ═════════════════════════════════════════════════════════════════════════════

describe("verificarToken", () => {
  // ── Sin token ─────────────────────────────────────────────────────────────

  test("401 si no hay header Authorization", () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Token no proporcionado" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("401 si el header no empieza con Bearer", () => {
    const req = makeReq({ headers: { authorization: "Basic abc123" } });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Token inválido / expirado ─────────────────────────────────────────────

  test("401 si el token está expirado", () => {
    const error = new Error("jwt expired");
    error.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => {
      throw error;
    });

    const req = makeReq({
      headers: { authorization: "Bearer token.expirado" },
    });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Token expirado" }),
    );
  });

  test("403 si el token es malformado", () => {
    const error = new Error("invalid token");
    error.name = "JsonWebTokenError";
    jwt.verify.mockImplementation(() => {
      throw error;
    });

    const req = makeReq({ headers: { authorization: "Bearer token.malo" } });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Token inválido" }),
    );
  });

  // ── Token válido — usuario normal ─────────────────────────────────────────

  test("llama next() y setea req.user con token válido de usuario normal", () => {
    const payload = { id: 5, role: "user", empresa_id: 1 };
    jwt.verify.mockReturnValue(payload);

    const req = makeReq({ headers: { authorization: "Bearer token.valido" } });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(payload);
  });

  // ── Token válido — superadmin ─────────────────────────────────────────────

  test("superadmin con x-empresa-id: setea empresa_id en payload y llama next()", () => {
    jwt.verify.mockReturnValue({ id: 1, role: "superadmin" });

    const req = makeReq({
      headers: {
        authorization: "Bearer token.super",
        "x-empresa-id": "7",
      },
    });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.empresa_id).toBe(7);
  });

  test("superadmin sin x-empresa-id en ruta de empresas: llama next()", () => {
    jwt.verify.mockReturnValue({ id: 1, role: "superadmin" });

    const req = makeReq({
      headers: { authorization: "Bearer token.super" },
      originalUrl: "/api/admin/empresas",
    });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("superadmin sin x-empresa-id en ruta protegida: 403", () => {
    jwt.verify.mockReturnValue({ id: 1, role: "superadmin" });

    const req = makeReq({
      headers: { authorization: "Bearer token.super" },
      originalUrl: "/api/conteos/guardar",
    });
    const res = makeRes();
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("seleccionar una empresa"),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// esAdmin
// ═════════════════════════════════════════════════════════════════════════════

describe("esAdmin", () => {
  test("401 si req.user no existe", () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    const next = jest.fn();

    esAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("llama next() si role es admin", () => {
    const req = makeReq({ user: { role: "admin" } });
    const res = makeRes();
    const next = jest.fn();

    esAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("llama next() si role es superadmin", () => {
    const req = makeReq({ user: { role: "superadmin" } });
    const res = makeRes();
    const next = jest.fn();

    esAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("403 si role es user", () => {
    const req = makeReq({ user: { role: "user" } });
    const res = makeRes();
    const next = jest.fn();

    esAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("administrativo"),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// esSuperAdmin
// ═════════════════════════════════════════════════════════════════════════════

describe("esSuperAdmin", () => {
  test("401 si req.user no existe", () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    const next = jest.fn();

    esSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("llama next() si role es superadmin", () => {
    const req = makeReq({ user: { role: "superadmin" } });
    const res = makeRes();
    const next = jest.fn();

    esSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("403 si role es admin", () => {
    const req = makeReq({ user: { role: "admin" } });
    const res = makeRes();
    const next = jest.fn();

    esSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("SuperAdmin"),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("403 si role es user", () => {
    const req = makeReq({ user: { role: "user" } });
    const res = makeRes();
    const next = jest.fn();

    esSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Validación de JWT_SECRET al cargar el módulo
// ═════════════════════════════════════════════════════════════════════════════

describe("validación de JWT_SECRET", () => {
  test("lanza error si JWT_SECRET no está definido al cargar el módulo", () => {
    jest.isolateModules(() => {
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => {
        require("../auth.middleware");
      }).toThrow("JWT_SECRET no está definido");

      process.env.JWT_SECRET = original;
    });
  });
});
