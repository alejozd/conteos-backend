const bcrypt = require("bcryptjs");
const db = require("../config/database"); // usa el mismo pool/conexión que ya tienes

// 1️⃣ Listar usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    const empresa_id = req.user.empresa_id; // Obtenido del token

    const rows = await db.query(
      `
      SELECT 
        u.id, u.username, u.role, u.activo, u.empresa_id,
        e.nombre AS empresa
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE u.empresa_id = ? -- Filtro crítico
      ORDER BY u.username
    `,
      [empresa_id]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error listando usuarios" });
  }
};

// 2️⃣ Crear usuario
exports.crearUsuario = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const empresa_id_admin = req.user.empresa_id;

    // ... (validaciones de campos vacíos y roles se mantienen igual) ...

    // 2️⃣ Verificar username único SOLO dentro de esta empresa
    const existing = await db.query(
      "SELECT id FROM usuarios WHERE username = ? AND empresa_id = ?",
      [username, empresa_id_admin] // Filtro por empresa añadido
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "El nombre de usuario ya está en uso en su empresa",
      });
    }

    // 3️⃣ Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4️⃣ Insertar usuario heredando la empresa del administrador logueado
    await db.query(
      `INSERT INTO usuarios (username, password, role, empresa_id, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [username, passwordHash, role, empresa_id_admin]
    );

    res.status(201).json({ message: "Usuario creado correctamente" });
  } catch (error) {
    console.error("Error creando usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// 3️⃣ Actualizar usuario (NO password aquí)
exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { password, role, empresa_id } = req.body;

  try {
    const rows = await db.query(
      "SELECT id, username FROM usuarios WHERE id = ?",
      [id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.username === "alejo") {
      return res.status(403).json({
        message: "Este usuario no puede ser modificado",
      });
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
      const bcrypt = require("bcryptjs");
      const hash = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        message: "No hay datos para actualizar",
      });
    }

    values.push(id);

    await db.query(
      `UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ message: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    res.status(500).json({ message: "Error actualizando usuario" });
  }
};

// 4️⃣ Activar / desactivar usuario
exports.cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    // seguridad básica
    if (req.user && Number(req.user.id) === Number(id)) {
      return res.status(403).json({
        message: "No puedes desactivar tu propio usuario",
      });
    }

    if (id === 1) {
      return res
        .status(403)
        .json({ message: "Este usuario no puede ser desactivado" });
    }

    await db.query("UPDATE usuarios SET activo = ? WHERE id = ?", [activo, id]);

    res.json({ message: "Estado actualizado correctamente" });
  } catch (error) {
    console.error("Error cambiando estado usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
