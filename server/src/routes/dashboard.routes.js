const express = require('express');
const { getSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', getSummary);

module.exports = router;
