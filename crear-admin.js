// crear-admin.js  ←  ejecuta esto una sola vez
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./src/config/database");

const username = "*****"; //usuario
const plainPassword = "******"; //texto del pass
const role = "admin";
const empresa_id = 1;

async function crearAdmin() {
  try {
    // Generamos el hash correcto
    const hash = bcrypt.hashSync(plainPassword, 10);
    console.log("Contraseña hasheada correctamente:");
    console.log(hash);

    // Upsert: si existe alejo lo actualiza, si no lo crea
    // const sql = `
    //   INSERT INTO usuarios (username, password, role, empresa_id, created_at)
    //   VALUES (?, ?, ?, ?, NOW())
    //   ON DUPLICATE KEY UPDATE
    //   UPDATE password = VALUES(password),
    //          role = VALUES(role),
    //          empresa_id = VALUES(empresa_id);
    // `;

    // await db.sequelize.query(sql, {
    //   replacements: [username, hash, role, empresa_id],
    // });

    const sql = `update usuarios set password = ? 
                 where id = 1`;

    await db.sequelize.query(sql, {
      replacements: [hash],
    });

    console.log(
      `Usuario ${username} creado/actualizado correctamente con rol admin`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

crearAdmin();
