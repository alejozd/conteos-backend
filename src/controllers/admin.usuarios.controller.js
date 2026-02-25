// src/controllers/admin.usuarios.controller.js
const bcrypt = require("bcryptjs");
const db = require("../config/database");

// ─── Listar usuarios ──────────────────────────────────────────────────────────

exports.listarUsuarios = async (req, res) => {
  try {
    let sql = `SELECT u.id, u.username, u.role, u.activo, u.empresa_id,
                         e.nombre AS empresa
                  FROM usuarios u
                  LEFT JOIN empresas e ON e.id = u.empresa_id`;
    let params = [];

    // Superadmin ve todos; el resto solo ve su empresa
    if (req.user.role !== "superadmin") {
      sql += " WHERE u.empresa_id = ?";
      params.push(req.user.empresa_id);
    }

    sql += " ORDER BY u.username";

    const rows = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("[admin.usuarios.listarUsuarios]", error);
    return res.status(500).json({ message: "Error listando usuarios" });
  }
};

// ─── Crear usuario ────────────────────────────────────────────────────────────

exports.crearUsuario = async (req, res) => {
  const { username, password, role, empresa_id } = req.body;

  // FIX: validar campos obligatorios antes de cualquier query
  if (!username || !password || !role) {
    return res
      .status(400)
      .json({ message: "username, password y role son obligatorios" });
  }

  try {
    // Superadmin puede asignar cualquier empresa; los demás heredan la suya
    const empresaAsignada =
      req.user.role === "superadmin" && empresa_id
        ? empresa_id
        : req.user.empresa_id;

    // Verificar username único dentro de la empresa
    const existing = await db.query(
      "SELECT id FROM usuarios WHERE username = ? AND empresa_id = ?",
      [username, empresaAsignada],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "El nombre de usuario ya está en uso en esa empresa",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO usuarios (username, password, role, empresa_id, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [username, passwordHash, role, empresaAsignada],
    );

    return res.status(201).json({ message: "Usuario creado correctamente" });
  } catch (error) {
    console.error("[admin.usuarios.crearUsuario]", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ─── Actualizar usuario ───────────────────────────────────────────────────────

exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { password, role, empresa_id } = req.body;

  try {
    const rows = await db.query(
      "SELECT id, username FROM usuarios WHERE id = ?",
      [id],
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // FIX: proteger por username en vez de hardcodear un ID numérico
    if (user.username === "alejo") {
      return res
        .status(403)
        .json({ message: "Este usuario no puede ser modificado" });
    }

    const fields = [];
    const values = [];

    if (role) {
      fields.push("role = ?");
      values.push(role);
    }

    if (empresa_id) {
      fields.push("empresa_id = ?");
      values.push(empresa_id);
    }

    if (password) {
      // FIX: bcrypt ya está importado arriba, no hace falta re-importarlo aquí
      const hash = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No hay datos para actualizar" });
    }

    values.push(id);

    await db.query(
      `UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    return res.json({ message: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error("[admin.usuarios.actualizarUsuario]", error);
    return res.status(500).json({ message: "Error actualizando usuario" });
  }
};

// ─── Activar / desactivar usuario ────────────────────────────────────────────

exports.cambiarEstadoUsuario = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  // FIX: validar que activo venga definido
  if (activo === undefined || activo === null) {
    return res
      .status(400)
      .json({ message: "El campo 'activo' es obligatorio" });
  }

  // Evitar que el usuario se desactive a sí mismo
  if (req.user && Number(req.user.id) === Number(id)) {
    return res
      .status(403)
      .json({ message: "No puedes desactivar tu propio usuario" });
  }

  // FIX: comparar como número, no como string (id viene como string desde params)
  if (Number(id) === 1) {
    return res
      .status(403)
      .json({ message: "Este usuario no puede ser desactivado" });
  }

  try {
    await db.query("UPDATE usuarios SET activo = ? WHERE id = ?", [activo, id]);
    return res.json({ message: "Estado actualizado correctamente" });
  } catch (error) {
    console.error("[admin.usuarios.cambiarEstadoUsuario]", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
