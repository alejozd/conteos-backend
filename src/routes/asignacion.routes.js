const express = require("express");
const router = express.Router();
const {
  getMiAsignacion,
  getMisBodegas,
  getMisUbicaciones,
  listarAsignacionesAdmin,
  cambiarEstadoAsignacion,
  getUbicacionesUsuarioAdmin,
  guardarMasivoAdmin,
  getResumenUsuarioGrupo,
} = require("../controllers/Asignacion.Controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/mi-tarea", verificarToken, getMiAsignacion);
router.get("/mis-bodegas", verificarToken, getMisBodegas);
router.get("/mis-ubicaciones", verificarToken, getMisUbicaciones);
router.get("/admin/listar", verificarToken, listarAsignacionesAdmin);
router.put("/admin/estado/:id", verificarToken, cambiarEstadoAsignacion);
router.get(
  "/admin/ubicaciones-usuario",
  verificarToken,
  getUbicacionesUsuarioAdmin
);
router.post("/guardar-masivo", verificarToken, guardarMasivoAdmin);
router.get("/admin/resumen-usuario", verificarToken, getResumenUsuarioGrupo);

module.exports = router;
