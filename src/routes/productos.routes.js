const express = require("express");
const router = express.Router();
router.get("/", (req, res) => res.json({ message: "productos ok" }));
module.exports = router;
