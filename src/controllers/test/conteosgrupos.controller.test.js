// src/controllers/test/conteosGrupos.controller.test.js
// Ejecutar con: npx jest conteosGrupos.controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({
  query: jest.fn(),
  sequelize: {
    query: jest.fn(),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

const db = require("../../config/database");

const {
  crearGrupoConteo,
  listarGruposConteo,
  editarGrupoConteo,
  activarGrupoConteo,
  desactivarGrupoConteo,
} = require("../conteosGrupos.controller");

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
// crearGrupoConteo
// ═════════════════════════════════════════════════════════════════════════════

describe("crearGrupoConteo", () => {
  test("400 si falta descripcion", async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();

    await crearGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "La descripción es obligatoria" }),
    );
  });

  test("400 si descripcion es solo espacios", async () => {
    const req = makeReq({ body: { descripcion: "   " } });
    const res = makeRes();

    await crearGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("crea grupo correctamente y retorna 201 con insertId", async () => {
    // db.sequelize.query para INSERT devuelve [insertId, metadata]
    db.sequelize.query.mockResolvedValueOnce([42, {}]);

    const req = makeReq({
      body: { descripcion: "Conteo Enero", fecha: "2024-01-15" },
    });
    const res = makeRes();

    await crearGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        grupo_id: 42,
        descripcion: "Conteo Enero",
        fecha: "2024-01-15",
      }),
    );
  });

  test("usa fecha actual si no se envía fecha", async () => {
    db.sequelize.query.mockResolvedValueOnce([10, {}]);

    const req = makeReq({ body: { descripcion: "Conteo Sin Fecha" } });
    const res = makeRes();

    await crearGrupoConteo(req, res);

    const respuesta = res.json.mock.calls[0][0];
    // La fecha debe tener formato YYYY-MM-DD
    expect(respuesta.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("hace trim a la descripcion", async () => {
    db.sequelize.query.mockResolvedValueOnce([5, {}]);

    const req = makeReq({ body: { descripcion: "  Conteo con espacios  " } });
    const res = makeRes();

    await crearGrupoConteo(req, res);

    const [, params] = db.sequelize.query.mock.calls[0];
    expect(params.replacements[1]).toBe("Conteo con espacios");
  });

  test("500 si falla la query", async () => {
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ body: { descripcion: "Conteo Test" } });
    const res = makeRes();

    await crearGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listarGruposConteo
// ═════════════════════════════════════════════════════════════════════════════

describe("listarGruposConteo", () => {
  test("retorna grupos de conteo de la empresa", async () => {
    const mockGrupos = [
      { id: 1, fecha: "2024-01-15", descripcion: "Enero", activo: 1 },
      { id: 2, fecha: "2024-02-10", descripcion: "Febrero", activo: 0 },
    ];
    db.query.mockResolvedValueOnce(mockGrupos);

    const req = makeReq();
    const res = makeRes();

    await listarGruposConteo(req, res);

    expect(res.json).toHaveBeenCalledWith(mockGrupos);
  });

  test("filtra por empresa_id del usuario", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ user: { id: 5, empresa_id: 9 } });
    const res = makeRes();

    await listarGruposConteo(req, res);

    expect(db.query.mock.calls[0][1]).toContain(9);
  });

  test("retorna array vacío si no hay grupos", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await listarGruposConteo(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await listarGruposConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// editarGrupoConteo
// ═════════════════════════════════════════════════════════════════════════════

describe("editarGrupoConteo", () => {
  test("400 si falta descripcion", async () => {
    const req = makeReq({ params: { id: "1" }, body: { fecha: "2024-01-15" } });
    const res = makeRes();

    await editarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si falta fecha", async () => {
    const req = makeReq({ params: { id: "1" }, body: { descripcion: "Test" } });
    const res = makeRes();

    await editarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "La fecha es obligatoria" }),
    );
  });

  test("404 si el grupo no existe", async () => {
    db.query.mockResolvedValueOnce([]); // SELECT grupo → vacío

    const req = makeReq({
      params: { id: "99" },
      body: { descripcion: "Test", fecha: "2024-01-15" },
    });
    const res = makeRes();

    await editarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("400 si el grupo ya tiene conteos asociados", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 1 }]) // SELECT grupo → existe
      .mockResolvedValueOnce([{ total: 5 }]); // COUNT conteos → tiene registros

    const req = makeReq({
      params: { id: "1" },
      body: { descripcion: "Test", fecha: "2024-01-15" },
    });
    const res = makeRes();

    await editarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("registros asociados"),
      }),
    );
  });

  test("edita grupo correctamente si no tiene conteos", async () => {
    db.query
      .mockResolvedValueOnce([{ id: 1 }]) // SELECT grupo
      .mockResolvedValueOnce([{ total: 0 }]) // COUNT → sin conteos
      .mockResolvedValueOnce([]); // UPDATE

    const req = makeReq({
      params: { id: "1" },
      body: { descripcion: "  Enero Actualizado  ", fecha: "2024-01-20" },
    });
    const res = makeRes();

    await editarGrupoConteo(req, res);

    // Verifica que se hizo trim
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE"),
      ["Enero Actualizado", "2024-01-20", "1", 1],
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Grupo de conteo actualizado correctamente",
      }),
    );
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({
      params: { id: "1" },
      body: { descripcion: "Test", fecha: "2024-01-15" },
    });
    const res = makeRes();

    await editarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// activarGrupoConteo
// ═════════════════════════════════════════════════════════════════════════════

describe("activarGrupoConteo", () => {
  test("404 si el grupo no existe en la empresa", async () => {
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 0 }]);

    const req = makeReq({ params: { id: "99" } });
    const res = makeRes();

    await activarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("activar") }),
    );
  });

  test("activa grupo correctamente", async () => {
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await activarGrupoConteo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Grupo de conteo activado correctamente",
      }),
    );
  });

  test("500 si falla la query", async () => {
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await activarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// desactivarGrupoConteo
// ═════════════════════════════════════════════════════════════════════════════

describe("desactivarGrupoConteo", () => {
  test("404 si el grupo no existe en la empresa", async () => {
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 0 }]);

    const req = makeReq({ params: { id: "99" } });
    const res = makeRes();

    await desactivarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("desactivar"),
      }),
    );
  });

  test("desactiva grupo correctamente", async () => {
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 1 }]);

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await desactivarGrupoConteo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Grupo de conteo desactivado correctamente",
      }),
    );
  });

  test("500 si falla la query", async () => {
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "1" } });
    const res = makeRes();

    await desactivarGrupoConteo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
