// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Middlewares globales
app.use(helmet());
app.use(
  cors({
    origin: "*", // después puedes restringir a tu dominio
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);
app.use(morgan("dev"));

// Rutas
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/empresas", require("./routes/empresas.routes"));
app.use("/api/productos", require("./routes/productos.routes"));
app.use("/api/conteos", require("./routes/conteos.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/ubicaciones", require("./routes/ubicaciones.routes"));

// Ruta de salud
app.get("/api", (req, res) => {
  res.json({ message: "API Conteos - corriendo OK", version: "1.0.0" });
});

module.exports = app;
