const express = require("express");
const route = express.Router();

route.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Selamat datang di API Sistem Penjurusan Skripsi",
    version: "2.0.0",
    endpoints: {
      auth: "/api/auth",
      jalur: "/api/jalur",
      topics: "/api/topics",
      submissions: "/api/submissions",
      mahasiswa: "/api/mahasiswa",
      dosen: "/api/dosen",
      admin: "/api/admin",
      sekretaris: "/api/sekretaris",
      pendaftaran: "/api/pendaftaran",
      upload: "/api/admin/upload",
    },
  });
});

const authRoutes = require("./authRoutes");
route.use("/api/auth", authRoutes);

const mahasiswaRoutes = require("./mahasiswaRoutes");
route.use("/api/mahasiswa", mahasiswaRoutes);

const jalurRoutes = require("./jalurRoutes");
route.use("/api/jalur", jalurRoutes);

const topikRoutes = require("./topikRoutes");
route.use("/api/topics", topikRoutes);

const submissionRoutes = require("./submissionRoutes");
route.use("/api/submissions", submissionRoutes);

const dosenRoutes = require("./dosenRoutes");
route.use("/api/dosen", dosenRoutes);

const adminRoutes = require("./adminRoutes");
route.use("/api/admin", adminRoutes);

const uploadRoutes = require("./uploadRoutes");
route.use("/api/admin/upload", uploadRoutes);

const sekretarisRoutes = require("./sekretarisRoutes");
route.use("/api/sekretaris", sekretarisRoutes);

const pendaftaranRoutes = require("./pendaftaranRoutes");
route.use("/api/pendaftaran", pendaftaranRoutes);

module.exports = route;
