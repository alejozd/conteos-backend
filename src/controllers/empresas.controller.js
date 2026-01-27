// src/controllers/empresas.controller.js
const db = require("../config/database");

const getEmpresas = async (req, res) => {
  try {
    const [rows] = await db.sequelize.query(
      "SELECT * FROM empresas ORDER BY nombre ASC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createEmpresa = async (req, res) => {
  const { nombre, nit, descripcion } = req.body;
  try {
    // Forzamos activo = 1 al crear una nueva empresa
    await db.sequelize.query(
      "INSERT INTO empresas (nombre, nit, descripcion, activo) VALUES (?, ?, ?, 1)",
      { replacements: [nombre, nit, descripcion] },
    );
    res.json({ message: "Empresa creada con éxito" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateEmpresa = async (req, res) => {
  const { id } = req.params;
  const { nombre, nit, descripcion, activo } = req.body;
  try {
    // Incluimos el campo activo para poder habilitar/deshabilitar
    await db.sequelize.query(
      "UPDATE empresas SET nombre = ?, nit = ?, descripcion = ?, activo = ? WHERE id = ?",
      { replacements: [nombre, nit, descripcion, activo, id] },
    );
    res.json({ message: "Empresa actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getEmpresas, createEmpresa, updateEmpresa };
