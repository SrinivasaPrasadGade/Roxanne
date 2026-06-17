"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logConversion = exports.UnsupportedConversionError = exports.TimeoutError = exports.ConversionError = exports.convertFile = void 0;
/**
 * Barrel export for the conversion module.
 */
var converter_1 = require("./converter");
Object.defineProperty(exports, "convertFile", { enumerable: true, get: function () { return converter_1.convertFile; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "ConversionError", { enumerable: true, get: function () { return errors_1.ConversionError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return errors_1.TimeoutError; } });
Object.defineProperty(exports, "UnsupportedConversionError", { enumerable: true, get: function () { return errors_1.UnsupportedConversionError; } });
var logger_1 = require("./logger");
Object.defineProperty(exports, "logConversion", { enumerable: true, get: function () { return logger_1.logConversion; } });
