const express = require("express");
const router = express.Router();
const {
  getEmpresas,
  createEmpresa,
  updateEmpresa,
} = require("../controllers/empresas.controller");
const {
  verificarToken,
  esSuperAdmin,
} = require("../middlewares/auth.middleware");

// Todas estas rutas requieren Token Y ser SuperAdmin
router.use(verificarToken, esSuperAdmin);

router.get("/", getEmpresas);
router.post("/", createEmpresa);
router.put("/:id", updateEmpresa);

module.exports = router;
