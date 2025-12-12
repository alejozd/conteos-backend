// src/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const {
  importarSaldos,
  cargarProductos,
  crearGrupoConteo,
  listarGruposConteo,
} = require("../controllers/admin.controller");
const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");

router.post("/importar-saldos", verificarToken, esAdmin, importarSaldos);
router.post("/cargar-productos", verificarToken, esAdmin, cargarProductos);
router.post("/grupos/crear", verificarToken, esAdmin, crearGrupoConteo);
router.get("/grupos/listar", verificarToken, esAdmin, listarGruposConteo);

module.exports = router;
