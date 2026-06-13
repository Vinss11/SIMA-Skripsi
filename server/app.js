const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const cors = require("cors");

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedVercelFrontend(origin) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "sima-skripsi.vercel.app" ||
        hostname === "sima-skripsi-git-main-vinss11s-projects.vercel.app" ||
        (hostname.startsWith("sima-skripsi-") && hostname.endsWith("-vinss11s-projects.vercel.app")))
    );
  } catch (error) {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isAllowedVercelFrontend(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
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
  console.error(err.stack);
  res.status(500).json({
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
