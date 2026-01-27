// src/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const {
  importarSaldos,
  cargarProductos,
  listarSaldosResumen,
  listarConteosDetalle,
  anularConteo,
  getConteosAnulados,
  listarProductos,
  conteos_stats,
} = require("../controllers/admin.controller");
const {
  crearGrupoConteo,
  listarGruposConteo,
  editarGrupoConteo,
  activarGrupoConteo,
  desactivarGrupoConteo,
} = require("../controllers/conteosGrupos.controller");
const { getComparativa } = require("../controllers/comparativa.controller");

const { verificarToken, esAdmin } = require("../middlewares/auth.middleware");

router.post("/importar-saldos", verificarToken, esAdmin, importarSaldos);
router.post("/cargar-productos", verificarToken, esAdmin, cargarProductos);
router.get("/saldos-resumen", verificarToken, esAdmin, listarSaldosResumen);
router.get("/conteos-detalle", verificarToken, esAdmin, listarConteosDetalle);
router.put("/conteos/:id/anular", verificarToken, esAdmin, anularConteo);
router.get("/conteos-anulados", verificarToken, esAdmin, getConteosAnulados);
router.get("/productos", verificarToken, esAdmin, listarProductos);
router.get("/conteos-stats", verificarToken, esAdmin, conteos_stats);

// Conteos Grupos
router.post("/conteos-grupos", verificarToken, esAdmin, crearGrupoConteo);

router.get("/conteos-grupos", verificarToken, esAdmin, listarGruposConteo);

router.put("/conteos-grupos/:id", verificarToken, esAdmin, editarGrupoConteo);

// Desactivar grupo de conteo
router.put(
  "/conteos-grupos/:id/desactivar",
  verificarToken,
  esAdmin,
  desactivarGrupoConteo,
);

// Activar grupo de conteo (desactiva los demás)
router.put(
  "/conteos-grupos/:id/activar",
  verificarToken,
  esAdmin,
  activarGrupoConteo,
);

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require("../controllers/admin.usuarios.controller");

router.get("/usuarios", verificarToken, esAdmin, listarUsuarios);
router.post("/usuarios", verificarToken, esAdmin, crearUsuario);
router.put("/usuarios/:id", verificarToken, esAdmin, actualizarUsuario);
router.patch(
  "/usuarios/:id/estado",
  verificarToken,
  esAdmin,
  cambiarEstadoUsuario,
);

const importarExcel = require("../controllers/importarExcel.controller");
const validarSaldo = require("../validators/saldos.validator");
const uploadExcel = require("../middlewares/uploadExcel");
const validarBodega = require("../validators/bodegas.validator");
const validarUbicacion = require("../validators/ubicaciones.validator");

// Productos
router.post(
  "/productos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    req.transformRow = (row) => ({
      NOMBRE: row.NOMBRE?.toString().trim().substring(0, 40),
      REFERENCIA: row.REFERENCIA?.toString().trim(),
      EMPRESA_ID: req.user.empresa_id,
    });

    // IMPORTANTE: Ponemos REFERENCIA de primero para que el controller
    // la use en el "WHERE" del SELECT de existencia.
    return importarExcel("productos", ["REFERENCIA", "NOMBRE", "EMPRESA_ID"])(
      req,
      res,
    );
  },
);

// Saldos
router.post(
  "/saldos/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  async (req, res) => {
    const db = require("../config/database");

    // 1. Usamos transformRow para preparar los datos antes de las validaciones
    req.transformRow = (row) => {
      // Mapeamos lo que viene del Excel a los nombres de la DB
      row.saldo = parseFloat(row.SALDO);
      row.empresa_id = req.user.empresa_id;
      // El producto_id lo pondremos en el validador porque es asíncrono
      return row;
    };

    // 2. IMPORTANTE: En el array de columnas ponemos lo que el controller
    // debe buscar en el objeto 'row' para insertar en la DB
    return importarExcel(
      "saldos_global",
      ["producto_id", "saldo", "empresa_id"],
      async (row, index, empresaId) => {
        try {
          // Buscamos el ID por REFERENCIA
          const [prod] = await db.sequelize.query(
            "SELECT id FROM productos WHERE referencia = ? AND empresa_id = ? LIMIT 1",
            { replacements: [row.REFERENCIA, empresaId] },
          );

          if (!prod.length) {
            return {
              fila: index + 2,
              campo: "REFERENCIA",
              mensaje: `Referencia ${row.REFERENCIA} no existe`,
            };
          }

          // Asignamos el ID encontrado al objeto que el controller va a insertar
          row.producto_id = prod[0].id;

          if (isNaN(row.saldo)) {
            return {
              fila: index + 2,
              campo: "SALDO",
              mensaje: "Saldo inválido",
            };
          }

          return null;
        } catch (e) {
          return { fila: index + 2, campo: "DB", mensaje: e.message };
        }
      },
    )(req, res);
  },
);

// Bodegas
router.post(
  "/bodegas/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    // Inyectamos empresa_id en cada fila
    req.transformRow = (row) => ({
      NOMBRE: row.NOMBRE,
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "bodegas",
      ["NOMBRE", "EMPRESA_ID"],
      validarBodega,
    )(req, res);
  },
);

//Ubicaciones
router.post(
  "/ubicaciones/importar",
  verificarToken,
  esAdmin,
  uploadExcel.single("file"),
  (req, res) => {
    // Solo normalizamos nombres
    req.transformRow = (row) => ({
      UBICACION: row.UBICACION?.trim(),
      BODEGA: row.BODEGA?.trim(),
      EMPRESA_ID: req.user.empresa_id,
    });

    return importarExcel(
      "ubicaciones",
      ["NOMBRE", "BODEGA_ID", "EMPRESA_ID"],
      validarUbicacion,
    )(req, res);
  },
);

// Ruta para obtener la matriz comparativa
// Se espera que los IDs vengan como query params: ?ids=1,2,3
router.get("/comparativa-conteos", verificarToken, esAdmin, getComparativa);

module.exports = router;
