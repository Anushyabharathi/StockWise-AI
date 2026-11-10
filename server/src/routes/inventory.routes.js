const express = require('express');
const { getInventory, getLowStock } = require('../controllers/inventory.controller');

const router = express.Router();

router.get('/', getInventory);
router.get('/low-stock', getLowStock);

module.exports = router;
