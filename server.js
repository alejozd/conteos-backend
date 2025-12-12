// server.js
require("dotenv").config();
const app = require("./src/app");
const http = require("http");
const { Server } = require("socket.io");

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Cambia a tu dominio en producción
    methods: ["GET", "POST"],
  },
});

// Guardamos io en la app para usarlo en los controladores
app.set("io", io);

// Eventos básicos de Socket.io (opcional por ahora)
io.on("connection", (socket) => {
  console.log("Usuario conectado via Socket.io:", socket.id);
  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3411;

server.listen(PORT, () => {
  console.log(`API Conteos corriendo en puerto ${PORT}`);
  console.log(`Socket.io listo`);
});
