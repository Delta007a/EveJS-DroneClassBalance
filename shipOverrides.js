"use strict";

const { readSettings } = require("./lib/settings");
const settings = readSettings(__dirname);
module.exports = settings.shipOverrides || { byName: {}, byTypeID: {} };
