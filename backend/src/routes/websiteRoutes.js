const express = require("express");
const router = express.Router();
const {
    analyzeWebsite,
    getWebsite,
    getAllWebsites,
} = require("../controllers/websiteController");

router.post("/analyze", analyzeWebsite);
router.get("/", getAllWebsites);
router.get("/:id", getWebsite);

module.exports = router;
