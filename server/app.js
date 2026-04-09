require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  const routes = require("./routes");
  app.use(routes);
} catch (error) {
  console.error("Gagal memuat routes:", error);
  process.exit(1);
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

app.listen(PORT, () => {
  console.log(`✓ Server berjalan di http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
});
