const express = require('express');
const { getSales, getSaleById, exportCsv } = require('../controllers/sales.controller');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, getSales);
router.get('/export', optionalAuth, exportCsv);
router.get('/:id', optionalAuth, getSaleById);

module.exports = router;
