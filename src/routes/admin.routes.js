// src/routes/admin.routes.js
const express = require("express");

const router = express.Router();

// ─── Controllers ──────────────────────────────────────────────────────────────

const {
  importarSaldos,
  cargarProductos,
  listarSaldosResumen,
  listarConteosDetalle,
  anularConteo,
  getConteosAnulados,
  listarProductos,
  conteos_stats,
  exportarConteosGrupo,
} = require("../controllers/admin.controller");

const {
  crearGrupoConteo,
  listarGruposConteo,
  editarGrupoConteo,
  activarGrupoConteo,
  desactivarGrupoConteo,
} = require("../controllers/conteosGrupos.controller");

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require("../controllers/admin.usuarios.controller");

const { getComparativa } = require("../controllers/comparativa.controller");
const importarExcel = require("../controllers/importarExcel.controller");

// ─── Middlewares ──────────────────────────────────────────────────────────────

const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");
const uploadExcel = require("../middlewares/uploadExcel");

// ─── Validators ───────────────────────────────────────────────────────────────

const validarSaldo = require("../validators/saldos.validator");
const validarBodega = require("../validators/bodegas.validator");
const validarUbicacion = require("../validators/ubicaciones.validator");

// ═════════════════════════════════════════════════════════════════════════════
// Admin general
// ═════════════════════════════════════════════════════════════════════════════

router.post("/importar-saldos", verificarToken, esAdmin, importarSaldos);
router.post("/cargar-productos", verificarToken, esAdmin, cargarProductos);
router.get("/saldos-resumen", verificarToken, esAdmin, listarSaldosResumen);
router.get("/conteos-detalle", verificarToken, esAdmin, listarConteosDetalle);
router.put("/conteos/:id/anular", verificarToken, esAdmin, anularConteo);
router.get("/conteos-anulados", verificarToken, esAdmin, getConteosAnulados);
router.get("/productos", verificarToken, esAdmin, listarProductos);
router.get("/conteos-stats", verificarToken, esAdmin, conteos_stats);
router.get("/conteos-exportar", verificarToken, esAdmin, exportarConteosGrupo);
router.get("/comparativa-conteos", verificarToken, esAdmin, getComparativa);

// ═════════════════════════════════════════════════════════════════════════════
// Grupos de conteo
// ═════════════════════════════════════════════════════════════════════════════

router.post("/conteos-grupos", verificarToken, esAdmin, crearGrupoConteo);
router.get("/conteos-grupos", verificarToken, esAdmin, listarGruposConteo);
router.put("/conteos-grupos/:id", verificarToken, esAdmin, editarGrupoConteo);
router.put(
  "/conteos-grupos/:id/activar",
  verificarToken,
  esAdmin,
  activarGrupoConteo,
);
router.put(
  "/conteos-grupos/:id/desactivar",
  verificarToken,
  esAdmin,
  desactivarGrupoConteo,
);

// ═════════════════════════════════════════════════════════════════════════════
// Usuarios
// ═════════════════════════════════════════════════════════════════════════════

router.get("/usuarios", verificarToken, esAdmin, listarUsuarios);
router.post("/usuarios", verificarToken, esAdmin, crearUsuario);
router.put("/usuarios/:id", verificarToken, esAdmin, actualizarUsuario);
router.patch(
  "/usuarios/:id/estado",
  verificarToken,
  esAdmin,
  cambiarEstadoUsuario,
);

// ═════════════════════════════════════════════════════════════════════════════
// Importación Excel
// FIX: toda la lógica de transformRow y validarFila fue movida a los validators.
// Las rutas solo conectan: auth → upload → importarExcel(tabla, columnas, validator)
// ═════════════════════════════════════════════════════════════════════════════

// Productos — transformRow se aplica en la ruta porque es solo formateo simple
// sin lógica de negocio ni acceso a DB
router.post(
  "/productos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      REFERENCIA: row.REFERENCIA?.toString().trim(),
      NOMBRE: row.NOMBRE?.toString().trim().substring(0, 40),
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel("productos", ["REFERENCIA", "NOMBRE", "EMPRESA_ID"])(
      req,
      res,
    );
  },
);

// Saldos — validarSaldo ahora resuelve REFERENCIA → producto_id internamente
router.post(
  "/saldos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      ...row,
      SALDO: parseFloat(row.SALDO),
      empresa_id: req.user.empresa_id,
    });

    return importarExcel(
      "saldos_global",
      ["producto_id", "saldo", "empresa_id"],
      validarSaldo,
    )(req, res);
  },
);

// Bodegas — validarBodega normaliza NOMBRE y controla duplicados
router.post(
  "/bodegas/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      NOMBRE: row.NOMBRE,
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "bodegas",
      ["NOMBRE", "EMPRESA_ID"],
      validarBodega,
    )(req, res);
  },
);

// Ubicaciones — validarUbicacion resuelve BODEGA → BODEGA_ID y asigna NOMBRE
router.post(
  "/ubicaciones/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      UBICACION: row.UBICACION?.trim(),
      BODEGA: row.BODEGA?.trim(),
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "ubicaciones",
      ["NOMBRE", "BODEGA_ID", "EMPRESA_ID"],
      validarUbicacion,
    )(req, res);
  },
);

module.exports = router;
