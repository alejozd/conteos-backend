// src/controllers/test/Asignacion.Controller.test.js
// Ejecutar con: npx jest Asignacion.Controller.test.js --verbose

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({
  query: jest.fn(),
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

const db = require("../../config/database");

const {
  getMiAsignacion,
  crearAsignacionMasiva,
  getMisBodegas,
  getMisUbicaciones,
  cerrarAsignacion,
  listarAsignacionesAdmin,
  cambiarEstadoAsignacion,
  finalizarBodegaAdmin,
  getUbicacionesUsuarioAdmin,
  getResumenUsuarioGrupo,
  guardarMasivoAdmin,
} = require("../Asignacion.Controller");

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
  user: { id: 5, empresa_id: 1 },
  ...overrides,
});

let mockTransaction;

beforeEach(() => {
  jest.clearAllMocks();

  mockTransaction = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  db.sequelize.transaction.mockResolvedValue(mockTransaction);
});

// ═════════════════════════════════════════════════════════════════════════════
// getMiAsignacion
// ═════════════════════════════════════════════════════════════════════════════

describe("getMiAsignacion", () => {
  test("404 si no hay asignaciones pendientes", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await getMiAsignacion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("pendientes"),
      }),
    );
  });

  test("retorna la asignación activa del usuario", async () => {
    const mockAsignacion = {
      asignacion_id: 1,
      conteo_grupo_id: 2,
      grupo_nombre: "Conteo Enero",
      ubicacion_id: 10,
      ubicacion_nombre: "Pasillo A",
      bodega_id: 3,
      bodega_nombre: "Bodega Central",
    };
    db.query.mockResolvedValueOnce([mockAsignacion]);

    const req = makeReq();
    const res = makeRes();

    await getMiAsignacion(req, res);

    expect(res.json).toHaveBeenCalledWith(mockAsignacion);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await getMiAsignacion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// crearAsignacionMasiva
// ═════════════════════════════════════════════════════════════════════════════

describe("crearAsignacionMasiva", () => {
  test("400 si falta usuario_id", async () => {
    const req = makeReq({
      body: { conteo_grupo_id: 1, ubicaciones: [10], empresa_id: 1 },
    });
    const res = makeRes();

    await crearAsignacionMasiva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si ubicaciones está vacío", async () => {
    const req = makeReq({
      body: {
        usuario_id: 1,
        conteo_grupo_id: 1,
        ubicaciones: [],
        empresa_id: 1,
      },
    });
    const res = makeRes();

    await crearAsignacionMasiva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si ubicaciones no es array", async () => {
    const req = makeReq({
      body: {
        usuario_id: 1,
        conteo_grupo_id: 1,
        ubicaciones: "10",
        empresa_id: 1,
      },
    });
    const res = makeRes();

    await crearAsignacionMasiva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("crea asignaciones masivas correctamente", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({
      body: {
        usuario_id: 2,
        conteo_grupo_id: 1,
        ubicaciones: [10, 11, 12],
        empresa_id: 1,
      },
    });
    const res = makeRes();

    await crearAsignacionMasiva(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "3 ubicaciones asignadas con éxito" }),
    );
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({
      body: {
        usuario_id: 1,
        conteo_grupo_id: 1,
        ubicaciones: [10],
        empresa_id: 1,
      },
    });
    const res = makeRes();

    await crearAsignacionMasiva(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getMisBodegas
// ═════════════════════════════════════════════════════════════════════════════

describe("getMisBodegas", () => {
  test("retorna bodegas del usuario", async () => {
    const mockBodegas = [{ id: 1, nombre: "Bodega Norte" }];
    db.query.mockResolvedValueOnce(mockBodegas);

    const req = makeReq();
    const res = makeRes();

    await getMisBodegas(req, res);

    expect(res.json).toHaveBeenCalledWith(mockBodegas);
  });

  test("retorna array vacío si no hay bodegas asignadas", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq();
    const res = makeRes();

    await getMisBodegas(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await getMisBodegas(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getMisUbicaciones
// ═════════════════════════════════════════════════════════════════════════════

describe("getMisUbicaciones", () => {
  test("400 si falta bodegaId", async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await getMisUbicaciones(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna ubicaciones del usuario en la bodega", async () => {
    const mockUbicaciones = [{ id: 10, nombre: "Pasillo A" }];
    db.query.mockResolvedValueOnce(mockUbicaciones);

    const req = makeReq({ query: { bodegaId: "3" } });
    const res = makeRes();

    await getMisUbicaciones(req, res);

    expect(res.json).toHaveBeenCalledWith(mockUbicaciones);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ query: { bodegaId: "3" } });
    const res = makeRes();

    await getMisUbicaciones(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// cerrarAsignacion
// ═════════════════════════════════════════════════════════════════════════════

describe("cerrarAsignacion", () => {
  test("cierra asignación correctamente", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ params: { asignacion_id: "7" } });
    const res = makeRes();

    await cerrarAsignacion(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("finalizada"),
      }),
    );
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { asignacion_id: "7" } });
    const res = makeRes();

    await cerrarAsignacion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listarAsignacionesAdmin
// ═════════════════════════════════════════════════════════════════════════════

describe("listarAsignacionesAdmin", () => {
  test("retorna lista de asignaciones", async () => {
    const mockRows = [{ id: 1, usuario_nombre: "carlos", estado: 0 }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq();
    const res = makeRes();

    await listarAsignacionesAdmin(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq();
    const res = makeRes();

    await listarAsignacionesAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// cambiarEstadoAsignacion
// ═════════════════════════════════════════════════════════════════════════════

describe("cambiarEstadoAsignacion", () => {
  test("400 si nuevoEstado no viene en el body", async () => {
    const req = makeReq({ params: { id: "1" }, body: {} });
    const res = makeRes();

    await cambiarEstadoAsignacion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("nuevoEstado"),
      }),
    );
  });

  test("cambia estado a cerrado (1) correctamente", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ params: { id: "3" }, body: { nuevoEstado: 1 } });
    const res = makeRes();

    await cambiarEstadoAsignacion(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Estado de asignación actualizado" }),
    );
  });

  test("cambia estado a abierto (0) correctamente", async () => {
    db.query.mockResolvedValueOnce([]);

    const req = makeReq({ params: { id: "3" }, body: { nuevoEstado: 0 } });
    const res = makeRes();

    await cambiarEstadoAsignacion(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Estado de asignación actualizado" }),
    );
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ params: { id: "3" }, body: { nuevoEstado: 1 } });
    const res = makeRes();

    await cambiarEstadoAsignacion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// finalizarBodegaAdmin
// ═════════════════════════════════════════════════════════════════════════════

describe("finalizarBodegaAdmin", () => {
  test("400 si falta algún parámetro obligatorio", async () => {
    const req = makeReq({ body: { usuarioId: 1, grupoId: 2 } }); // falta bodegaId
    const res = makeRes();

    await finalizarBodegaAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("finaliza bodega y retorna count de filas afectadas", async () => {
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 5 }]);

    const req = makeReq({ body: { usuarioId: 1, grupoId: 2, bodegaId: 3 } });
    const res = makeRes();

    await finalizarBodegaAdmin(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("finalizadas"),
        count: 5,
      }),
    );
  });

  test("retorna count 0 si no hay filas afectadas", async () => {
    db.sequelize.query.mockResolvedValueOnce([[], { affectedRows: 0 }]);

    const req = makeReq({ body: { usuarioId: 1, grupoId: 2, bodegaId: 3 } });
    const res = makeRes();

    await finalizarBodegaAdmin(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ count: 0 }),
    );
  });

  test("500 si falla la query", async () => {
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ body: { usuarioId: 1, grupoId: 2, bodegaId: 3 } });
    const res = makeRes();

    await finalizarBodegaAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getUbicacionesUsuarioAdmin
// ═════════════════════════════════════════════════════════════════════════════

describe("getUbicacionesUsuarioAdmin", () => {
  test("400 si faltan parámetros", async () => {
    const req = makeReq({ query: { usuarioId: "1" } }); // falta bodegaId
    const res = makeRes();

    await getUbicacionesUsuarioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna ubicaciones del usuario en la bodega", async () => {
    const mockRows = [{ id: 10, nombre: "Estante B2" }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { usuarioId: "2", bodegaId: "3" } });
    const res = makeRes();

    await getUbicacionesUsuarioAdmin(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ query: { usuarioId: "2", bodegaId: "3" } });
    const res = makeRes();

    await getUbicacionesUsuarioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getResumenUsuarioGrupo
// ═════════════════════════════════════════════════════════════════════════════

describe("getResumenUsuarioGrupo", () => {
  test("400 si faltan parámetros", async () => {
    const req = makeReq({ query: { usuarioId: "1" } }); // falta grupoId
    const res = makeRes();

    await getResumenUsuarioGrupo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna resumen de bodegas con total de ubicaciones", async () => {
    const mockRows = [{ bodega_nombre: "Bodega Sur", total_ubicaciones: 8 }];
    db.query.mockResolvedValueOnce(mockRows);

    const req = makeReq({ query: { usuarioId: "2", grupoId: "1" } });
    const res = makeRes();

    await getResumenUsuarioGrupo(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRows);
  });

  test("500 si falla la query", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({ query: { usuarioId: "2", grupoId: "1" } });
    const res = makeRes();

    await getResumenUsuarioGrupo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// guardarMasivoAdmin
// ═════════════════════════════════════════════════════════════════════════════

describe("guardarMasivoAdmin", () => {
  test("400 si falta usuario_id", async () => {
    const req = makeReq({
      body: { conteo_grupo_id: 1, bodega_id: 2 },
    });
    const res = makeRes();

    await guardarMasivoAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("400 si hay conflicto con otro grupo activo", async () => {
    // db.query devuelve un conflicto encontrado
    db.query.mockResolvedValueOnce([{ descripcion: "Conteo Febrero" }]);

    const req = makeReq({
      body: {
        usuario_id: 2,
        conteo_grupo_id: 1,
        bodega_id: 3,
        ubicaciones: [10],
      },
    });
    const res = makeRes();

    await guardarMasivoAdmin(req, res);

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Conteo Febrero"),
      }),
    );
  });

  test("guarda correctamente sin ubicaciones (solo DELETE)", async () => {
    db.query.mockResolvedValueOnce([]); // sin conflicto
    db.sequelize.query.mockResolvedValueOnce([[], {}]); // DELETE

    const req = makeReq({
      body: {
        usuario_id: 2,
        conteo_grupo_id: 1,
        bodega_id: 3,
        ubicaciones: [],
      },
    });
    const res = makeRes();

    await guardarMasivoAdmin(req, res);

    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sincronización exitosa" }),
    );
  });

  test("guarda correctamente con ubicaciones (DELETE + INSERT)", async () => {
    db.query.mockResolvedValueOnce([]); // sin conflicto
    db.sequelize.query
      .mockResolvedValueOnce([[], {}]) // DELETE
      .mockResolvedValueOnce([[], {}]); // INSERT

    const req = makeReq({
      body: {
        usuario_id: 2,
        conteo_grupo_id: 1,
        bodega_id: 3,
        ubicaciones: [10, 11],
      },
    });
    const res = makeRes();

    await guardarMasivoAdmin(req, res);

    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(db.sequelize.query).toHaveBeenCalledTimes(2); // DELETE + INSERT
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sincronización exitosa" }),
    );
  });

  test("hace rollback y retorna 500 si falla el DELETE", async () => {
    db.query.mockResolvedValueOnce([]); // sin conflicto
    db.sequelize.query.mockRejectedValueOnce(new Error("DB error")); // DELETE falla

    const req = makeReq({
      body: {
        usuario_id: 2,
        conteo_grupo_id: 1,
        bodega_id: 3,
        ubicaciones: [10],
      },
    });
    const res = makeRes();

    await guardarMasivoAdmin(req, res);

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
