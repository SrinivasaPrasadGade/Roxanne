"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const convert_1 = require("./routes/convert");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
// Create temp directories
const UPLOADS_DIR = '/tmp/uploads';
const OUTPUTS_DIR = '/tmp/outputs';
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs_1.default.existsSync(OUTPUTS_DIR)) {
    fs_1.default.mkdirSync(OUTPUTS_DIR, { recursive: true });
}
// Setup CORS
app.use((0, cors_1.default)({
    origin: ALLOWED_ORIGINS.split(','),
    credentials: true
}));
app.use(express_1.default.json());
// Health endpoint
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});
// Mount conversion routes
app.use(convert_1.convertRouter);
// Global error handler — always returns JSON { error, code }
app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    // Handle multer file-size errors that bubble up
    if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
            error: 'File exceeds the maximum allowed size',
            code: 'FILE_TOO_LARGE',
        });
        return;
    }
    res.status(500).json({
        error: err.message || 'Internal server error',
        code: 'SERVER_ERROR',
    });
});
app.listen(PORT, () => {
    console.log(`Roxanne backend running on http://localhost:${PORT}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);
    console.log(`Outputs directory: ${OUTPUTS_DIR}`);
});
