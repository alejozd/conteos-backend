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
} = require("../controllers/admin.controller");
const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");

router.post("/importar-saldos", verificarToken, esAdmin, importarSaldos);
router.post("/cargar-productos", verificarToken, esAdmin, cargarProductos);
router.post("/grupos/crear", verificarToken, esAdmin, crearGrupoConteo);
router.get("/grupos/listar", verificarToken, esAdmin, listarGruposConteo);
router.get("/saldos-resumen", verificarToken, esAdmin, listarSaldosResumen);
router.get("/conteos-detalle", verificarToken, esAdmin, listarConteosDetalle);
router.put("/conteos/:id/anular", verificarToken, esAdmin, anularConteo);

module.exports = router;
