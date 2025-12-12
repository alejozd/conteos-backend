// src/config/database.js
const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "conteosdb",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    logging: false,
    timezone: "-05:00",
    dialectOptions: {
      connectTimeout: 5000,
    },
    define: {
      timestamps: false,
    },
  }
);

// Helper para queries raw (igual que en vecinos)
const db = {
  sequelize,
  query: async (sql, params = []) => {
    try {
      const [rows] = await sequelize.query(sql, { replacements: params });
      return rows;
    } catch (error) {
      console.warn("Error en query SQL (modo local sin BD):", error.message);
      return []; // ← nunca rompe la app
    }
  },
};

// Prueba conexión solo una vez
sequelize
  .authenticate()
  .then(() => console.log("MySQL conectado correctamente"))
  .catch((err) =>
    console.warn("MySQL no disponible (modo desarrollo local):", err.message)
  );

module.exports = db;
