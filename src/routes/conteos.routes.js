// src/routes/conteos.routes.js
const express = require("express");
const router = express.Router();
const { guardar, listarActivos } = require("../controllers/conteos.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

// Solo usuarios logueados pueden contar
router.post("/guardar", verificarToken, guardar);

// Listar los grupos activos (usuario normal)
router.get("/grupos/activos", verificarToken, listarActivos);

module.exports = router;
