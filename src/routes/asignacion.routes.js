const express = require("express");
const router = express.Router();
const {
  getMiAsignacion,
  getMisUbicaciones,
  listarAsignacionesAdmin,
  cambiarEstadoAsignacion,
} = require("../controllers/Asignacion.Controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/mi-tarea", verificarToken, getMiAsignacion);
router.get("/mis-ubicaciones", verificarToken, getMisUbicaciones);
router.get("/admin/listar", verificarToken, listarAsignacionesAdmin);
router.put("/admin/estado/:id", verificarToken, cambiarEstadoAsignacion);

module.exports = router;
