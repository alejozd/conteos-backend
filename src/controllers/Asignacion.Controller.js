// src/controllers/Asignacion.Controller.js
const db = require("../config/database");

const AsignacionController = {
  // ─── Obtener mi asignación activa (usuario logueado) ───────────────────────

  getMiAsignacion: async (req, res) => {
    const usuarioId = req.user.id;

    try {
      const rows = await db.query(
        `SELECT 
                a.id as asignacion_id,
                a.conteo_grupo_id,
                g.descripcion as grupo_nombre,
                a.ubicacion_id,
                u.nombre as ubicacion_nombre,
                u.bodega_id,
                b.nombre as bodega_nombre,
                g.fecha
            FROM conteos_asignaciones a
            INNER JOIN conteos_grupos g ON a.conteo_grupo_id = g.id
            INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
            INNER JOIN bodegas b ON u.bodega_id = b.id
            WHERE a.usuario_id = ? AND a.estado = 0 AND g.activo = 1
            LIMIT 1`,
        [usuarioId],
      );

      if (!rows || rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No tienes asignaciones pendientes." });
      }

      return res.json(rows[0]);
    } catch (error) {
      console.error("[Asignacion.getMiAsignacion]", error);
      return res
        .status(500)
        .json({ message: "Error al obtener la asignación" });
    }
  },

  // ─── Crear asignaciones masivas (admin) ────────────────────────────────────

  crearAsignacionMasiva: async (req, res) => {
    const { usuario_id, conteo_grupo_id, ubicaciones, empresa_id } = req.body;

    // FIX: validar campos obligatorios antes de operar
    if (!usuario_id || !conteo_grupo_id || !empresa_id) {
      return res.status(400).json({
        message: "usuario_id, conteo_grupo_id y empresa_id son obligatorios",
      });
    }

    if (!Array.isArray(ubicaciones) || ubicaciones.length === 0) {
      return res
        .status(400)
        .json({ message: "ubicaciones debe ser un array no vacío" });
    }

    try {
      const values = ubicaciones.map((ubiId) => [
        usuario_id,
        conteo_grupo_id,
        ubiId,
        empresa_id,
        0,
      ]);

      await db.query(
        "INSERT INTO conteos_asignaciones (usuario_id, conteo_grupo_id, ubicacion_id, empresa_id, estado) VALUES ?",
        [values],
      );

      return res.json({
        message: `${ubicaciones.length} ubicaciones asignadas con éxito`,
      });
    } catch (error) {
      console.error("[Asignacion.crearAsignacionMasiva]", error);
      return res
        .status(500)
        .json({ message: "Error al crear las asignaciones masivas" });
    }
  },

  // ─── Mis bodegas con asignaciones pendientes ───────────────────────────────

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
        [usuarioId],
      );

      return res.json(rows);
    } catch (error) {
      console.error("[Asignacion.getMisBodegas]", error);
      return res.status(500).json({ message: "Error al obtener mis bodegas" });
    }
  },

  // ─── Mis ubicaciones por bodega ────────────────────────────────────────────

  getMisUbicaciones: async (req, res) => {
    const usuarioId = req.user.id;
    const { bodegaId } = req.query;

    // FIX: validar param obligatorio
    if (!bodegaId) {
      return res.status(400).json({ message: "bodegaId es obligatorio" });
    }

    try {
      const rows = await db.query(
        `SELECT 
                u.id, 
                u.nombre 
            FROM conteos_asignaciones a
            INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
            WHERE a.usuario_id = ? 
              AND u.bodega_id = ? 
              AND a.estado = 0`,
        [usuarioId, bodegaId],
      );

      return res.json(rows);
    } catch (error) {
      console.error("[Asignacion.getMisUbicaciones]", error);
      return res
        .status(500)
        .json({ message: "Error al obtener ubicaciones asignadas" });
    }
  },

  // ─── Cerrar asignación (admin) ─────────────────────────────────────────────

  cerrarAsignacion: async (req, res) => {
    const { asignacion_id } = req.params;

    try {
      await db.query(
        `UPDATE conteos_asignaciones SET estado = 1 WHERE id = ?`,
        [asignacion_id],
      );

      return res.json({
        message: "Asignación marcada como finalizada por el administrador",
      });
    } catch (error) {
      console.error("[Asignacion.cerrarAsignacion]", error);
      return res.status(500).json({ message: "Error al cerrar la asignación" });
    }
  },

  // ─── Listar todas las asignaciones (admin) ─────────────────────────────────

  listarAsignacionesAdmin: async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT
            a.id,
            u.username     AS usuario_nombre,
            g.descripcion  AS grupo_nombre,
            b.nombre       AS bodega_nombre,
            ubi.nombre     AS ubicacion_nombre,
            a.estado,
            a.created_at
         FROM conteos_asignaciones a
         INNER JOIN usuarios       u   ON a.usuario_id       = u.id
         INNER JOIN conteos_grupos g   ON a.conteo_grupo_id  = g.id
         INNER JOIN ubicaciones    ubi ON a.ubicacion_id     = ubi.id
         INNER JOIN bodegas        b   ON ubi.bodega_id      = b.id
         ORDER BY a.created_at DESC`,
      );

      return res.json(rows);
    } catch (error) {
      console.error("[Asignacion.listarAsignacionesAdmin]", error);
      return res
        .status(500)
        .json({ message: "Error al obtener lista para admin" });
    }
  },

  // ─── Cambiar estado de asignación (admin) ──────────────────────────────────

  cambiarEstadoAsignacion: async (req, res) => {
    const { id } = req.params;
    const { nuevoEstado } = req.body;

    // FIX: validar que nuevoEstado esté definido
    if (nuevoEstado === undefined || nuevoEstado === null) {
      return res.status(400).json({ message: "nuevoEstado es obligatorio" });
    }

    try {
      await db.query(
        "UPDATE conteos_asignaciones SET estado = ? WHERE id = ?",
        [nuevoEstado, id],
      );

      return res.json({ message: "Estado de asignación actualizado" });
    } catch (error) {
      console.error("[Asignacion.cambiarEstadoAsignacion]", error);
      return res.status(500).json({ message: "Error al actualizar estado" });
    }
  },

  // ─── Finalizar todas las ubicaciones de una bodega (admin) ─────────────────

  finalizarBodegaAdmin: async (req, res) => {
    const { usuarioId, grupoId, bodegaId } = req.body;

    if (!usuarioId || !grupoId || !bodegaId) {
      return res.status(400).json({
        message: "usuarioId, grupoId y bodegaId son obligatorios",
      });
    }

    try {
      // FIX: db.query() devuelve rows, no el objeto con affectedRows.
      // Para obtener affectedRows usamos db.sequelize.query directamente.
      const [, meta] = await db.sequelize.query(
        `UPDATE conteos_asignaciones AS a
         INNER JOIN ubicaciones AS u ON a.ubicacion_id = u.id
         SET a.estado = 1
         WHERE a.usuario_id       = ?
           AND a.conteo_grupo_id  = ?
           AND u.bodega_id        = ?
           AND a.estado           = 0`,
        {
          replacements: [Number(usuarioId), Number(grupoId), Number(bodegaId)],
        },
      );

      return res.json({
        message: "Todas las ubicaciones de la bodega han sido finalizadas.",
        count: meta?.affectedRows ?? 0,
      });
    } catch (error) {
      console.error("[Asignacion.finalizarBodegaAdmin]", error);
      return res
        .status(500)
        .json({ message: "Error al finalizar la bodega masivamente" });
    }
  },

  // ─── Ubicaciones de un usuario en una bodega (admin) ───────────────────────

  getUbicacionesUsuarioAdmin: async (req, res) => {
    const { usuarioId, bodegaId } = req.query;

    if (!usuarioId || !bodegaId) {
      return res
        .status(400)
        .json({ message: "usuarioId y bodegaId son obligatorios" });
    }

    try {
      const rows = await db.query(
        `SELECT u.id, u.nombre 
       FROM conteos_asignaciones a
       INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
       WHERE a.usuario_id = ? AND u.bodega_id = ? AND a.estado = 0`,
        [usuarioId, bodegaId],
      );

      return res.json(rows);
    } catch (error) {
      console.error("[Asignacion.getUbicacionesUsuarioAdmin]", error);
      return res.status(500).json({ message: "Error al obtener asignaciones" });
    }
  },

  // ─── Resumen de asignaciones por bodega de un usuario ──────────────────────

  getResumenUsuarioGrupo: async (req, res) => {
    const { usuarioId, grupoId } = req.query;

    if (!usuarioId || !grupoId) {
      return res
        .status(400)
        .json({ message: "usuarioId y grupoId son obligatorios" });
    }

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
        [usuarioId, grupoId],
      );

      return res.json(rows);
    } catch (error) {
      console.error("[Asignacion.getResumenUsuarioGrupo]", error);
      return res.status(500).json({ message: "Error al obtener resumen" });
    }
  },

  // ─── Guardar/sincronizar asignaciones masivas con validación (admin) ────────

  guardarMasivoAdmin: async (req, res) => {
    const usuario_id = Number(req.body.usuario_id);
    const conteo_grupo_id = Number(req.body.conteo_grupo_id);
    const { ubicaciones, bodega_id } = req.body;
    const empresa_id = req.user.empresa_id;

    if (!usuario_id || !conteo_grupo_id || !bodega_id) {
      return res.status(400).json({
        message: "usuario_id, conteo_grupo_id y bodega_id son obligatorios",
      });
    }

    const transaction = await db.sequelize.transaction();

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
        [usuario_id, conteo_grupo_id, empresa_id],
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
          nombreGrupo,
        );

        return res.status(400).json({
          message: `BLOQUEADO: El usuario ya tiene tareas pendientes en el grupo "${conflicto[0].descripcion}". Debe finalizarlas antes de cambiar de grupo.`,
        });
      }

      // 2. Eliminar asignaciones anteriores de esa bodega en ese grupo
      await db.sequelize.query(
        `DELETE a FROM conteos_asignaciones a
             INNER JOIN ubicaciones u ON a.ubicacion_id = u.id
             WHERE a.usuario_id = ? 
               AND u.bodega_id = ? 
               AND a.conteo_grupo_id = ?
               AND a.estado = 0`,
        [usuario_id, bodega_id, conteo_grupo_id],
      );

      // 3. Insertar nuevas ubicaciones si las hay
      if (Array.isArray(ubicaciones) && ubicaciones.length > 0) {
        const values = ubicaciones.map((ubiId) => [
          usuario_id,
          conteo_grupo_id,
          ubiId,
          empresa_id,
          0,
        ]);

        await db.sequelize.query(
          "INSERT INTO conteos_asignaciones (usuario_id, conteo_grupo_id, ubicacion_id, empresa_id, estado) VALUES ?",
          [values],
        );
      }

      await transaction.commit();
      return res.json({ message: "Sincronización exitosa" });
    } catch (error) {
      await transaction.rollback();
      console.error("[Asignacion.guardarMasivoAdmin]", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  },
};

module.exports = AsignacionController;
