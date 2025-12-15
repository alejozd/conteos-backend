const bcrypt = require("bcryptjs");
const db = require("../config/database"); // usa el mismo pool/conexión que ya tienes

// 1️⃣ Listar usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    const rows = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.role,
        u.activo,
        u.empresa_id,
        e.nombre AS empresa
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      ORDER BY u.username
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error listando usuarios:", error);
    res.status(500).json({ message: "Error listando usuarios" });
  }
};

// 2️⃣ Crear usuario
exports.crearUsuario = async (req, res) => {
  const { username, password, role = "user", empresa_id } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username y password son obligatorios" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO usuarios (username, password, role, empresa_id)
       VALUES (?, ?, ?, ?)`,
      [username, hash, role, empresa_id || null]
    );

    res.status(201).json({ message: "Usuario creado correctamente" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "El usuario ya existe" });
    }

    console.error("Error creando usuario:", error);
    res.status(500).json({ message: "Error creando usuario" });
  }
};

// 3️⃣ Actualizar usuario (NO password aquí)
exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { username, role, empresa_id } = req.body;

  try {
    // 🔒 Proteger usuario alejo
    const [[user]] = await db.query(
      "SELECT username FROM usuarios WHERE id = ?",
      [id]
    );

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.username === "alejo") {
      return res
        .status(403)
        .json({ message: "Este usuario no se puede modificar" });
    }

    await db.query(
      `UPDATE usuarios
       SET username = ?, role = ?, empresa_id = ?
       WHERE id = ?`,
      [username, role, empresa_id || null, id]
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
