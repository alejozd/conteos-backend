const express = require("express");
const router = express.Router();
router.get("/", (req, res) => res.json({ message: "conteos ok" }));
module.exports = router;
