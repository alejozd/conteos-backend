// controllers/AsignacionController.js
const db = require("../config/database"); // Tu conexión a la base de datos

const AsignacionController = {
  getMiAsignacion: async (req, res) => {
    const usuarioId = req.user.id;

    try {
      // En tu controller de ubicaciones haces: const rows = await db.query(...)
      // Hagamos lo mismo aquí sin el "result[0]"
      const rows = await db.query(
        `SELECT 
                a.id as asignacion_id,
                a.conteo_grupo_id,
                g.descripcion as grupo_nombre,
                a.ubicacion_id,
                u.nombre as ubicacion_nombre,
                u.bodega_id,
                b.nombre as bodega_nombre
            FROM conteos_asignaciones a
            INNER JOIN conteos_grupos g ON a.conteo_grupo_id = g.id
            INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
            INNER JOIN bodegas b ON u.bodega_id = b.id
            WHERE a.usuario_id = ? AND a.estado = 0 AND g.activo = 1
            LIMIT 1`,
        [usuarioId]
      );

      // Si rows es nulo o vacío
      if (!rows || rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No tienes asignaciones pendientes." });
      }

      // Como usamos LIMIT 1, enviamos el primer (y único) objeto
      res.json(rows[0]);
    } catch (error) {
      console.error("DETALLE DEL ERROR:", error.message);
      res.status(500).json({ message: "Error al obtener la asignación" });
    }
  },

  // 2. Método para que Daniel cree asignaciones (para el Admin)
  crearAsignacionMasiva: async (req, res) => {
    const { usuario_id, conteo_grupo_id, ubicaciones, empresa_id } = req.body;
    // ubicaciones ahora es un array: [16, 17, 18...]

    try {
      // Creamos un array de arrays para el insert múltiple de MySQL
      const values = ubicaciones.map((ubiId) => [
        usuario_id,
        conteo_grupo_id,
        ubiId,
        empresa_id,
        0, // estado inicial
      ]);

      await db.query(
        "INSERT INTO conteos_asignaciones (usuario_id, conteo_grupo_id, ubicacion_id, empresa_id, estado) VALUES ?",
        [values]
      );

      res.json({
        message: `${ubicaciones.length} ubicaciones asignadas con éxito`,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error al crear las asignaciones masivas" });
    }
  },

  getMisBodegas: async (req, res) => {
    const usuarioId = req.user.id;
    try {
      const rows = await db.query(
        `SELECT DISTINCT 
          b.id, 
          b.nombre 
       FROM conteos_asignaciones a
       INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
       INNER JOIN bodegas b ON u.bodega_id = b.id
       WHERE a.usuario_id = ? AND a.estado = 0`,
        [usuarioId]
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener mis bodegas" });
    }
  },

  getMisUbicaciones: async (req, res) => {
    const usuarioId = req.user.id;
    const { bodegaId } = req.query;

    try {
      // Quitamos el [rows] y usamos la respuesta directa como en el anterior
      const rows = await db.query(
        `SELECT 
                u.id, 
                u.nombre 
            FROM conteos_asignaciones a
            INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
            WHERE a.usuario_id = ? 
              AND u.bodega_id = ? 
              AND a.estado = 0`,
        [usuarioId, bodegaId]
      );

      res.json(rows);
    } catch (error) {
      console.error("Error en mis-ubicaciones:", error.message);
      res
        .status(500)
        .json({ message: "Error al obtener ubicaciones asignadas" });
    }
  },

  // Método para que Daniel cierre la tarea manualmente
  cerrarAsignacion: async (req, res) => {
    const { asignacion_id } = req.params; // Daniel elige qué ID cerrar

    try {
      await db.query(
        `UPDATE conteos_asignaciones SET estado = 1 WHERE id = ?`,
        [asignacion_id]
      );
      res.json({
        message: "Asignación marcada como finalizada por el administrador",
      });
    } catch (error) {
      res.status(500).json({ message: "Error al cerrar la asignación" });
    }
  },

  listarAsignacionesAdmin: async (req, res) => {
    try {
      const rows = await db.query(`
                SELECT 
                    a.id,
                    u.username as usuario_nombre,
                    g.descripcion as grupo_nombre,
                    b.nombre as bodega_nombre,
                    ubi.nombre as ubicacion_nombre,
                    a.estado,
                    a.created_at
                FROM conteos_asignaciones a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN conteos_grupos g ON a.conteo_grupo_id = g.id
                INNER JOIN ubicaciones ubi ON a.ubicacion_id = ubi.id
                INNER JOIN bodegas b ON ubi.bodega_id = b.id
                ORDER BY a.created_at DESC
            `);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener lista para admin" });
    }
  },

  cambiarEstadoAsignacion: async (req, res) => {
    const { id } = req.params;
    const { nuevoEstado } = req.body; // 1 para Cerrar, 0 para Reabrir

    try {
      await db.query(
        "UPDATE conteos_asignaciones SET estado = ? WHERE id = ?",
        [nuevoEstado, id]
      );
      res.json({ message: "Estado de asignación actualizado" });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar estado" });
    }
  },

  getUbicacionesUsuarioAdmin: async (req, res) => {
    const { usuarioId, bodegaId } = req.query; // Daniel envía estos parámetros
    try {
      const rows = await db.query(
        `SELECT u.id, u.nombre 
       FROM conteos_asignaciones a
       INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
       WHERE a.usuario_id = ? AND u.bodega_id = ? AND a.estado = 0`,
        [usuarioId, bodegaId]
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener asignaciones" });
    }
  },

  guardarMasivoAdmin: async (req, res) => {
    const { usuario_id, conteo_grupo_id, ubicaciones, bodega_id } = req.body;
    // Obtenemos empresa_id del token (req.user lo llena el middleware verificarToken)
    const empresa_id = req.user.empresa_id;

    try {
      await db.query("START TRANSACTION");

      // 1. Borrar pendientes previas
      await db.query(
        `DELETE a FROM conteos_asignaciones a
       INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
       WHERE a.usuario_id = ? AND u.bodega_id = ? AND a.estado = 0`,
        [usuario_id, bodega_id]
      );

      // 2. Insertar nuevas
      if (ubicaciones && ubicaciones.length > 0) {
        const values = ubicaciones.map((ubiId) => [
          usuario_id,
          conteo_grupo_id,
          ubiId,
          empresa_id, // Usamos el del token
          0,
        ]);

        // IMPORTANTE: Verifica que tu librería de BD acepte [values]
        // Si usas mysql2, el formato es [[row1, row2...]]
        await db.query(
          "INSERT INTO conteos_asignaciones (usuario_id, conteo_grupo_id, ubicacion_id, empresa_id, estado) VALUES ?",
          [values]
        );
      }

      await db.query("COMMIT");
      res.json({ message: "Asignación actualizada" });
    } catch (e) {
      await db.query("ROLLBACK");
      console.error("ERROR EN GUARDAR MASIVO:", e.message);
      res.status(500).json({ message: "Error al guardar asignaciones" });
    }
  },
};

module.exports = AsignacionController;
