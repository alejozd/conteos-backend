// src/routes/productos.routes.js  ← versión FINAL limpia
const express = require("express");
const router = express.Router();
const { buscar } = require("../controllers/productos.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

// Todos los endpoints de productos requieren login
router.get("/buscar", verificarToken, buscar);
// router.get("/", verificarToken, esAdmin, async (req, res) => { ... });

module.exports = router;
