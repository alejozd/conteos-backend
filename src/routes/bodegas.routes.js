const express = require("express");
const router = express.Router();
const { listar } = require("../controllers/bodegas.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/listar", verificarToken, listar);

module.exports = router;
