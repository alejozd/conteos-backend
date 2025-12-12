// src/routes/ubicaciones.routes.js
const express = require("express");
const router = express.Router();
const { listar } = require("../controllers/ubicaciones.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

// Requiere login
router.get("/listar", verificarToken, listar);

module.exports = router;
