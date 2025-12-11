// server.js
const app = require("./src/app");

const PORT = process.env.PORT || 3411;

app.listen(PORT, () => {
  console.log(`API Conteos corriendo en puerto ${PORT}`);
});
