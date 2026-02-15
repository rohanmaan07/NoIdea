const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const {
    analyzeWebsite,
    getWebsite,
    getAllWebsites,
} = require("../controllers/websiteController");
const analyzeRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 10,
    message: {
        success: false,
        error: "Too many analysis requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/analyze", analyzeRateLimiter, analyzeWebsite);
router.get("/", getAllWebsites);
router.get("/:id", getWebsite);

module.exports = router;
