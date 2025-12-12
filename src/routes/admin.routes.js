// src/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const {
  importarSaldos,
  cargarProductos,
} = require("../controllers/admin.controller");
const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");

router.post("/importar-saldos", verificarToken, esAdmin, importarSaldos);
router.post("/cargar-productos", verificarToken, esAdmin, cargarProductos);

module.exports = router;
