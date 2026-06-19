const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const cors = require("cors");
const { createCorsOriginValidator } = require("./config/cors");

app.use(
  cors({
    origin: createCorsOriginValidator(),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  const routes = require("./routes");
  app.use(routes);
} catch (error) {
  console.error("Gagal memuat routes:", error);
  app.use((req, res) => {
    res.status(500).json({
      success: false,
      message: "Gagal memuat routes backend",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  if (err?.code === "CORS_ORIGIN_NOT_ALLOWED") {
    return res.status(403).json({
      success: false,
      message: "Origin frontend tidak diizinkan mengakses API.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  console.error(err.stack);
  return res.status(err.status || 500).json({
    success: false,
    message: "Terjadi kesalahan pada server",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan",
    path: req.path,
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

module.exports = app;
