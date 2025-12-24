const express = require("express");
const router = express.Router();
const {
  listar,
  crear,
  actualizar,
  eliminar,
} = require("../controllers/bodegas.admin.controller");
const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");

router.get("/", verificarToken, esAdmin, listar);
router.post("/", verificarToken, esAdmin, crear);
router.put("/:id", verificarToken, esAdmin, actualizar);
router.delete("/:id", verificarToken, esAdmin, eliminar);

module.exports = router;
