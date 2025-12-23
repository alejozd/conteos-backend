// src/middlewares/uploadExcel.js
const multer = require("multer");

// Configuración para guardar en memoria
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos Excel (.xlsx)"));
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
