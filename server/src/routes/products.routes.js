const express = require('express');
const { getTopSelling } = require('../controllers/products.controller');

const router = express.Router();

router.get('/top-selling', getTopSelling);

module.exports = router;
