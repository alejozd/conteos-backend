// src/middlewares/uploadExcel.js
const multer = require("multer");

// Tipos MIME aceptados para Excel
const EXCEL_MIMETYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
]);

// FIX: límite de 10MB — memoryStorage carga el archivo completo en RAM,
// sin límite un archivo grande puede agotar la memoria del servidor
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const fileFilter = (req, file, cb) => {
  if (EXCEL_MIMETYPES.has(file.mimetype)) {
    return cb(null, true);
  }
  // FIX: mensaje consistente con los tipos realmente aceptados
  return cb(new Error("Solo se permiten archivos Excel (.xlsx, .xls)"));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = upload;
