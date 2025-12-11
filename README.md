# Conteos Backend - Inventario en tiempo real

Backend Node.js + Express + MySQL para la aplicación web de conteo físico de inventario (Metrocerámicas y futuros clientes).

## Características principales
- Autenticación segura con JWT + bcrypt
- Multi-empresa (multi-tenant) desde el día 1
- Importación automática de saldos globales desde ERP Firebird (app Delphi)
- Conteos por grupos (ej: Conteo Anual 2025)
- Soporte para productos con código + subcódigo
- Cantidades con decimales
- Búsqueda rápida de productos
- Vista en tiempo real para administradores (Socket.io)
- Listo para escalar a SaaS (alquiler a otras empresas)

## Tecnologías
- Node.js 20
- Express.js
- MySQL 8
- JWT + bcryptjs
- Socket.io (actualizaciones en vivo)
- PM2 (producción)
- Nodemon (desarrollo)

## Estructura de carpetas
```
src/
├── config/          → conexión DB
├── controllers/     → lógica de negocio
├── middlewares/     → auth, roles
├── routes/          → endpoints API
├── app.js
└── server.js
```

Método,Ruta,Descripción
POST,/api/auth/login,Login → devuelve JWT
POST,/api/admin/importar-saldos,Recibe saldos desde Delphi
GET,/api/productos/buscar,Buscar por código + subcódigo
POST,/api/conteos/guardar,Guardar conteo físico
GET,/api/admin/dashboard,Vista en tiempo real (admin)