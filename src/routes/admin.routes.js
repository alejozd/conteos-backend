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

// Productos
router.post(
  "/productos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  importarExcel("productos", [
    "CODIGO",
    "SUBCODIGO",
    "NOMBRE",
    "REFERENCIA",
    "EMPRESA_ID",
  ])
);

// Saldos
router.post(
  "/saldos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  importarExcel(
    "saldos_global",
    ["CODIGO", "SUBCODIGO", "REFERENCIA", "SALDO", "EMPRESA_ID"],
    validarSaldo
  )
);

module.exports = router;
