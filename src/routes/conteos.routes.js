// src/routes/conteos.routes.js
const express = require("express");
const router = express.Router();
const { guardar } = require("../controllers/conteos.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

// Solo usuarios logueados pueden contar
router.post("/guardar", verificarToken, guardar);

module.exports = router;
