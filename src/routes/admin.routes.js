// src/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const {
  importarSaldos,
  cargarProductos,
  crearGrupoConteo,
  listarGruposConteo,
  listarSaldosResumen,
  listarConteosDetalle,
  anularConteo,
  getConteosAnulados,
  listarProductos,
} = require("../controllers/admin.controller");
const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");

router.post("/importar-saldos", verificarToken, esAdmin, importarSaldos);
router.post("/cargar-productos", verificarToken, esAdmin, cargarProductos);
router.post("/grupos/crear", verificarToken, esAdmin, crearGrupoConteo);
router.get("/grupos/listar", verificarToken, esAdmin, listarGruposConteo);
router.get("/saldos-resumen", verificarToken, esAdmin, listarSaldosResumen);
router.get("/conteos-detalle", verificarToken, esAdmin, listarConteosDetalle);
router.put("/conteos/:id/anular", verificarToken, esAdmin, anularConteo);
router.get("/conteos-anulados", verificarToken, esAdmin, getConteosAnulados);
router.get("/productos", verificarToken, esAdmin, listarProductos);

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require("../controllers/admin.usuarios.controller");

router.get("/usuarios", verificarToken, esAdmin, listarUsuarios);
router.post("/usuarios", verificarToken, esAdmin, crearUsuario);
router.put("/usuarios/:id", verificarToken, esAdmin, actualizarUsuario);
router.patch(
  "/usuarios/:id/estado",
  verificarToken,
  esAdmin,
  cambiarEstadoUsuario
);

const importarExcel = require("../controllers/importarExcel.controller");
const validarSaldo = require("../validators/saldos.validator");
const uploadExcel = require("../middlewares/uploadExcel");
const validarBodega = require("../validators/bodegas.validator");
const validarUbicacion = require("../validators/ubicaciones.validator");

// Productos
router.post(
  "/productos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      ...row,
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel("productos", [
      "CODIGO",
      "SUBCODIGO",
      "NOMBRE",
      "REFERENCIA",
      "EMPRESA_ID",
    ])(req, res);
  }
);

// Saldos
router.post(
  "/saldos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      ...row,
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "saldos_global",
      ["CODIGO", "SUBCODIGO", "REFERENCIA", "SALDO", "EMPRESA_ID"],
      validarSaldo
    )(req, res);
  }
);

// Bodegas
router.post(
  "/bodegas/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    // Inyectamos empresa_id en cada fila
    req.transformRow = (row) => ({
      NOMBRE: row.NOMBRE,
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "bodegas",
      ["NOMBRE", "EMPRESA_ID"],
      validarBodega
    )(req, res);
  }
);

//Ubicaciones
router.post(
  "/ubicaciones/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    // Solo normalizamos nombres
    req.transformRow = (row) => ({
      UBICACION: row.UBICACION?.trim(),
      BODEGA: row.BODEGA?.trim(),
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "ubicaciones",
      ["NOMBRE", "BODEGA_ID", "EMPRESA_ID"],
      validarUbicacion
    )(req, res);
  }
);

module.exports = router;
