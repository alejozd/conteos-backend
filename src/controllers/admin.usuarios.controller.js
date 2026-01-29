const bcrypt = require("bcryptjs");
const db = require("../config/database"); // usa el mismo pool/conexión que ya tienes

// 1️⃣ Listar usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.username, u.role, u.activo, u.empresa_id, e.nombre AS empresa
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
    `;
    let params = [];

    // Si NO es superadmin, filtramos para que solo vea los de su empresa
    if (req.user.role !== "superadmin") {
      query += " WHERE u.empresa_id = ?";
      params.push(req.user.empresa_id);
    }

    query += " ORDER BY u.username";
    const rows = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error listando usuarios" });
  }
};

// 2️⃣ Crear usuario
exports.crearUsuario = async (req, res) => {
  try {
    // 1️⃣ Recibimos empresa_id desde el cuerpo de la petición (Frontend)
    const { username, password, role, empresa_id } = req.body;
    const empresa_id_admin = req.user.empresa_id;

    // 2️⃣ Lógica de decisión de Empresa:
    // Si el usuario logueado es superadmin, usamos el empresa_id que envió.
    // Si no es superadmin (o no envió uno), usamos la empresa del admin (herencia).
    const empresaAsignada =
      req.user.role === "superadmin" && empresa_id
        ? empresa_id
        : empresa_id_admin;

    // Verificación de username único (Filtro por empresa asignada)
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

    // 3️⃣ Insertamos usando la empresaAsignada calculada
    await db.query(
      `INSERT INTO usuarios (username, password, role, empresa_id, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [username, passwordHash, role, empresaAsignada],
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
      [id],
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
      values,
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
