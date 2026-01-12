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

  finalizarBodegaAdmin: async (req, res) => {
    console.log("BODY RECIBIDO:", req.body);
    // Asegúrate de que los nombres coincidan con lo que envía el frontend
    const { usuarioId, grupoId, bodegaId } = req.body;

    // Validación preventiva
    if (!usuarioId || !grupoId || !bodegaId) {
      return res.status(400).json({
        message:
          "Faltan parámetros: usuarioId, grupoId o bodegaId son obligatorios.",
      });
    }

    try {
      const sql = `
            UPDATE conteos_asignaciones AS a
            INNER JOIN ubicaciones AS u ON a.ubicacion_id = u.id
            SET a.estado = 1
            WHERE a.usuario_id = ? 
              AND a.conteo_grupo_id = ? 
              AND u.bodega_id = ? 
              AND a.estado = 0
        `;

      const params = [Number(usuarioId), Number(grupoId), Number(bodegaId)];

      const result = await db.query(sql, params);

      // En algunas librerías de Node, el resultado viene en un array [rows, fields]
      // o directamente el objeto de resultado.
      const affected =
        result?.affectedRows !== undefined ? result.affectedRows : "procesado";

      console.log(`Filas finalizadas: ${affected}`);

      res.json({
        message: "Todas las ubicaciones de la bodega han sido finalizadas.",
        count: affected,
      });
    } catch (error) {
      console.error("Error al finalizar bodega:", error);
      res
        .status(500)
        .json({ message: "Error al finalizar la bodega masivamente" });
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

  getResumenUsuarioGrupo: async (req, res) => {
    const { usuarioId, grupoId } = req.query;
    try {
      const rows = await db.query(
        `SELECT 
          b.nombre as bodega_nombre, 
          COUNT(a.ubicacion_id) as total_ubicaciones
       FROM conteos_asignaciones a
       INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
       INNER JOIN bodegas b ON u.bodega_id = b.id
       WHERE a.usuario_id = ? AND a.conteo_grupo_id = ? AND a.estado = 0
       GROUP BY b.id, b.nombre`,
        [usuarioId, grupoId]
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener resumen" });
    }
  },

  guardarMasivoAdmin: async (req, res) => {
    const usuario_id = Number(req.body.usuario_id);
    const conteo_grupo_id = Number(req.body.conteo_grupo_id);
    const { ubicaciones, bodega_id } = req.body;
    const empresa_id = req.user.empresa_id;

    console.log("=== TRACE: INICIO GUARDAR MASIVO ===");

    try {
      // 1. VALIDACIÓN SIN DESESTRUCTURAR PARA ANALIZAR EL OBJETO
      const result = await db.query(
        `SELECT cg.descripcion 
             FROM conteos_asignaciones ca
             JOIN conteos_grupos cg ON ca.conteo_grupo_id = cg.id
             WHERE ca.usuario_id = ? 
               AND ca.conteo_grupo_id <> ? 
               AND ca.estado = 0 
               AND ca.empresa_id = ?
             LIMIT 1`,
        [usuario_id, conteo_grupo_id, empresa_id]
      );

      // LÓGICA DE DETECCIÓN DINÁMICA:
      // Algunos drivers devuelven [rows, fields], otros solo rows.
      let rows = [];
      if (Array.isArray(result)) {
        // Si el primer elemento es un array, son las filas (mysql2 estándar)
        // Si el primer elemento es un objeto, result mismo son las filas (mysql estándar)
        rows = Array.isArray(result[0]) ? result[0] : result;
      } else if (result && result.rows) {
        rows = result.rows; // Para drivers tipo pg o wrappers específicos
      }

      console.log("Trace de Filas:", rows);

      // Verificamos si encontramos al menos un registro
      if (rows && rows.length > 0) {
        // Extraemos la descripción de la primera fila encontrada
        const nombreGrupo = rows[0].descripcion;
        console.log(
          "!!! BLOQUEO ACTIVADO !!! Conflicto detectado con:",
          nombreGrupo
        );

        return res.status(400).json({
          message: `BLOQUEADO: El usuario ya tiene tareas pendientes en el grupo "${nombreGrupo}". Debe finalizarlas antes de cambiar de grupo.`,
        });
      }

      console.log("Validación superada: No hay conflictos.");

      // 2. PROCESO DE GUARDADO
      await db.query("START TRANSACTION");

      await db.query(
        `DELETE a FROM conteos_asignaciones a
             INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
             WHERE a.usuario_id = ? 
               AND u.bodega_id = ? 
               AND a.conteo_grupo_id = ?
               AND a.estado = 0`,
        [usuario_id, bodega_id, conteo_grupo_id]
      );

      if (ubicaciones && ubicaciones.length > 0) {
        const values = ubicaciones.map((ubiId) => [
          usuario_id,
          conteo_grupo_id,
          ubiId,
          empresa_id,
          0,
        ]);

        await db.query(
          "INSERT INTO conteos_asignaciones (usuario_id, conteo_grupo_id, ubicacion_id, empresa_id, estado) VALUES ?",
          [values]
        );
      }

      await db.query("COMMIT");
      console.log("=== TRACE: FINALIZADO CON ÉXITO ===");
      res.json({ message: "Sincronización exitosa" });
    } catch (e) {
      console.error("!!! ERROR CRÍTICO EN TRACE !!!", e.message);
      if (db.query) await db.query("ROLLBACK");
      res.status(500).json({ message: "Error interno del servidor" });
    }
  },
};

module.exports = AsignacionController;
