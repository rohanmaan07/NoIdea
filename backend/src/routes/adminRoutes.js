const express = require("express");
const router = express.Router();
const { getQueueStats, getAnalysisStats } = require("../controllers/adminController.js");

// TODO: Add auth middleware here when ready
// router.use(authMiddleware);

router.get("/queue-stats", getQueueStats);
router.get("/analysis-stats", getAnalysisStats);

module.exports = router;
