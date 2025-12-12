// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");

router.post("/login", authCtrl.login);
// router.post("/register", authCtrl.register); // lo agregamos después

module.exports = router;
