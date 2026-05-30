import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardPlus, Loader2, Send } from "lucide-react";

const PENDAFTARAN_OPTIONS = [
  {
    value: "baru",
    label: "Baru",
    description: "Pendaftaran pertama kali untuk menentukan jalur skripsi.",
  },
  {
    value: "ulang",
    label: "Ulang",
    description: "Mengajukan kembali jalur yang sama karena pengajuan sebelumnya belum dilanjutkan.",
  },
  {
    value: "alih",
    label: "Alih",
    description: "Berpindah dari jalur sebelumnya ke jalur skripsi yang berbeda.",
  },
];

const JALUR_OPTIONS = [
  { value: "penelitian", label: "Penelitian" },
  { value: "pengabdian", label: "Pengabdian kepada Masyarakat" },
  { value: "perintisan_bisnis", label: "Perintisan Bisnis" },
  { value: "magang", label: "Magang" },
];
const MAHASISWA_EMAIL_DOMAIN = "students.uii.ac.id";
const NIM_REGEX = /^\d{8}$/;
const NAMA_REGEX = /^[a-zA-Z\s'.-]+$/;
const NO_DOSEN_OPTION_VALUE = "__NO_DOSEN_PEMBIMBING__";
const buildMahasiswaEmailFromNim = (nim) =>
  nim && nim.length > 0 ? `${nim}@${MAHASISWA_EMAIL_DOMAIN}`.toLowerCase() : "";

function PendaftaranJalurPage({ apiBaseUrl, onBack, onRegisterSuccess }) {
  const [periodeAktif, setPeriodeAktif] = useState(null);
  const [loadingPeriode, setLoadingPeriode] = useState(true);
  const [loadingDosen, setLoadingDosen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [dosenOptions, setDosenOptions] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    nim: "",
    nama: "",
    dosen_pembimbing_akademik_id: "",
    pendaftaran: "baru",
    jenis_jalur_diambil: "",
    dosen_pembimbing_ta_id: "",
    jenis_jalur_ulang: "",
    dosen_pembimbing_ta_sebelumnya_id: "",
    dosen_pembimbing_ta_baru_id: "",
    penjaluran_sebelumnya: "",
    penjaluran_baru: "",
  });
  const pendaftaranDitutup = !loadingPeriode && !periodeAktif;

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (name === "nim") {
      value = value.replace(/\D/g, "").slice(0, 8);
      const generatedEmail = buildMahasiswaEmailFromNim(value);
      setFormData((prev) => ({ ...prev, nim: value, email: generatedEmail }));
      return;
    }

    if (name === "nama") {
      value = value.slice(0, 100);
    }

    if (name === "email") {
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const renderRadioGroup = ({ name, value, options, disabled = false }) => (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label
          key={`${name}-${option.value}`}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            value === option.value
              ? "border-[#2f63e3] bg-[#eff4ff] text-[#173d9f]"
              : "border-[#d8e0f3] bg-white text-[#2d3f6f]"
          } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={(event) => {
              const { name: inputName, value: inputValue } = event.target;
              setFormData((prev) => ({ ...prev, [inputName]: inputValue }));
            }}
            className="h-4 w-4 border-[#9cb0dc] text-[#2f63e3] focus:ring-[#2f63e3]"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );

  const formatDosenLabel = (dosen) => {
    const identifier = dosen.nik || dosen.kode_dosen || dosen.email || "-";
    return `${dosen.nama} (${identifier})`;
  };

  const renderDosenSelect = ({
    name,
    label,
    value,
    disabled = false,
    prioritizeNoBimbingan = false,
        disableKuotaPenuh = false,
    allowNoSupervisorOption = false,
  }) => {
    const prioritasNoBimbingan = prioritizeNoBimbingan
      ? dosenOptions.filter((dosen) => dosen.is_no_bimbingan && !dosen.is_kuota_penuh)
      : [];
    const dosenLainnya = prioritizeNoBimbingan
      ? dosenOptions.filter((dosen) => !(dosen.is_no_bimbingan && !dosen.is_kuota_penuh))
      : dosenOptions;
    const dropdownOptions = [...prioritasNoBimbingan, ...dosenLainnya];

    return (
      <div>
        <label className="mb-1 block text-sm font-semibold text-[#324c86]">{label}</label>
        <select
          name={name}
          value={value}
          disabled={disabled || loadingDosen}
          onChange={handleChange}
          className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm text-[#203462] outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20 disabled:bg-[#f2f5fc] disabled:text-[#8b95af]"
        >
          <option value="">{loadingDosen ? "Memuat data dosen..." : "Pilih dosen"}</option>
          {allowNoSupervisorOption ? <option value={NO_DOSEN_OPTION_VALUE}>Belum dapat dosen pembimbing</option> : null}
          {dropdownOptions.map((dosen) => (
            <option key={`${name}-${dosen.id}`} value={dosen.id} disabled={disableKuotaPenuh && dosen.is_kuota_penuh}>
              {formatDosenLabel(dosen)}
            </option>
          ))}
        </select>
      </div>
    );
  };

  useEffect(() => {
    let mounted = true;

    const loadDosen = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/pendaftaran/dosen`);
        if (response.status === 404) {
          throw new Error(
            "Endpoint dosen belum tersedia (404). Restart backend agar route /api/pendaftaran/dosen terbaca."
          );
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Gagal memuat data dosen.");
        }
        if (mounted) {
          setDosenOptions(Array.isArray(data.data) ? data.data : []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || "Gagal memuat data dosen.");
        }
      } finally {
        if (mounted) {
          setLoadingDosen(false);
        }
      }
    };

    const loadPeriode = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/pendaftaran/periode-aktif`);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          if (response.status === 404 || response.status === 403) {
            if (mounted) {
              setPeriodeAktif(null);
            }
            throw new Error(data?.message || "Periode pendaftaran masih belum dibuka oleh sekretaris prodi.");
          }
          throw new Error(data?.message || "Gagal memuat periode penjaluran.");
        }
        if (mounted) {
          setPeriodeAktif(data.data);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || "Gagal memuat periode penjaluran.");
        }
      } finally {
        if (mounted) {
          setLoadingPeriode(false);
        }
      }
    };

    loadDosen();
    loadPeriode();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (formData.pendaftaran === "baru") {
      setFormData((prev) => ({
        ...prev,
        jenis_jalur_ulang: "",
        dosen_pembimbing_ta_sebelumnya_id: "",
        dosen_pembimbing_ta_baru_id: "",
        penjaluran_sebelumnya: "",
        penjaluran_baru: "",
      }));
      return;
    }

    if (formData.pendaftaran === "ulang") {
      setFormData((prev) => ({
        ...prev,
        jenis_jalur_diambil: "",
        dosen_pembimbing_ta_id: "",
        penjaluran_sebelumnya: "",
        penjaluran_baru: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      jenis_jalur_diambil: "",
      dosen_pembimbing_ta_id: "",
      jenis_jalur_ulang: "",
    }));
  }, [formData.pendaftaran]);

  const resetForm = () => {
    setFormData({
      email: "",
      nim: "",
      nama: "",
      dosen_pembimbing_akademik_id: "",
      pendaftaran: "baru",
      jenis_jalur_diambil: "",
      dosen_pembimbing_ta_id: "",
      jenis_jalur_ulang: "",
      dosen_pembimbing_ta_sebelumnya_id: "",
      dosen_pembimbing_ta_baru_id: "",
      penjaluran_sebelumnya: "",
      penjaluran_baru: "",
    });
    setStep(1);
  };

  const validateStepOne = () => {
    if (!formData.nim || !formData.nama || !formData.dosen_pembimbing_akademik_id) {
      return "Lengkapi data umum terlebih dahulu (NIM, Nama, dan Dosen Pembimbing Akademik).";
    }

    const nim = formData.nim.trim();
    if (!NIM_REGEX.test(nim)) {
      return "NIM wajib tepat 8 digit angka.";
    }

    const nama = formData.nama.trim();
    if (nama.length < 2 || nama.length > 100) {
      return "Nama wajib 2 sampai 100 karakter.";
    }
    if (!NAMA_REGEX.test(nama)) {
      return "Nama hanya boleh huruf, spasi, titik, apostrof, dan tanda hubung.";
    }

    const expectedEmail = buildMahasiswaEmailFromNim(nim);
    const email = formData.email.trim().toLowerCase();
    if (email !== expectedEmail) {
      return `Email otomatis harus sesuai format ${expectedEmail}.`;
    }

    return "";
  };

  const handleNext = () => {
    setError("");
    if (pendaftaranDitutup) {
      setError("Periode pendaftaran masih belum dibuka oleh sekretaris prodi.");
      return;
    }
    const commonError = validateStepOne();
    if (commonError) {
      setError(commonError);
      return;
    }
    setStep(2);
  };

  const handleBackStep = () => {
    setError("");
    setStep(1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (pendaftaranDitutup) {
      setError("Periode pendaftaran masih belum dibuka oleh sekretaris prodi.");
      return;
    }

    const commonError = validateStepOne();
    if (commonError) {
      setError(commonError);
      setStep(1);
      return;
    }

    if (formData.pendaftaran === "baru") {
      if (!formData.jenis_jalur_diambil) {
        setError("Lengkapi field lanjutan untuk jalur baru.");
        return;
      }
    } else if (formData.pendaftaran === "ulang") {
      if (
        !formData.jenis_jalur_ulang ||
        !formData.dosen_pembimbing_ta_sebelumnya_id ||
        !formData.dosen_pembimbing_ta_baru_id
      ) {
        setError("Lengkapi field lanjutan untuk jalur ulang.");
        return;
      }
    } else if (formData.pendaftaran === "alih") {
      if (
        !formData.penjaluran_sebelumnya ||
        !formData.penjaluran_baru ||
        !formData.dosen_pembimbing_ta_sebelumnya_id ||
        !formData.dosen_pembimbing_ta_baru_id
      ) {
        setError("Lengkapi field lanjutan untuk jalur alih.");
        return;
      }
    }

    const parseOptionalDosenId = (rawValue) => {
      if (!rawValue || rawValue === NO_DOSEN_OPTION_VALUE) return null;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };

    try {
      setIsSubmitting(true);
      const normalizedNim = formData.nim.trim();
      const generatedEmail = buildMahasiswaEmailFromNim(normalizedNim);
      const response = await fetch(`${apiBaseUrl}/api/pendaftaran/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: generatedEmail,
          nim: normalizedNim,
          nama: formData.nama.trim(),
          pendaftaran: formData.pendaftaran,
          dosen_pembimbing_akademik_id: Number(formData.dosen_pembimbing_akademik_id),
          jenis_jalur_diambil: formData.jenis_jalur_diambil,
          jenis_jalur_ulang: formData.jenis_jalur_ulang,
          dosen_pembimbing_ta_id: parseOptionalDosenId(formData.dosen_pembimbing_ta_id),
          dosen_pembimbing_ta_sebelumnya_id: parseOptionalDosenId(formData.dosen_pembimbing_ta_sebelumnya_id),
          dosen_pembimbing_ta_baru_id: parseOptionalDosenId(formData.dosen_pembimbing_ta_baru_id),
          penjaluran_sebelumnya: formData.penjaluran_sebelumnya,
          penjaluran_baru: formData.penjaluran_baru,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Pendaftaran gagal diproses.");
      }

      const registeredEmail = generatedEmail;
      const registeredNim = normalizedNim;
      const registerPayload = {
        ...data.data,
        registered_email: registeredEmail,
        registered_nim: registeredNim,
      };

      resetForm();
      onRegisterSuccess?.(registerPayload);
    } catch (submitError) {
      setError(submitError.message || "Pendaftaran gagal diproses.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#d7e7ff]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL})`,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(18,39,87,0.45)_0%,rgba(31,78,183,0.25)_45%,rgba(223,236,255,0.2)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl rounded-[28px] border border-white/50 bg-white/90 p-8 shadow-[0_35px_80px_-30px_rgba(20,56,118,0.55)] backdrop-blur-md sm:p-12">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#1e45b0]">
            <ClipboardPlus className="h-6 w-6" />
          </div>

          <h1 className="text-3xl font-black text-[#10224f] sm:text-4xl">Form Penjaluran Skripsi</h1>
          <p className="mt-2 text-base text-[#4f5f85]">
            Langkah 1 isi informasi umum, lalu klik <strong>Lanjutkan</strong> untuk membuka form lanjutan sesuai jalur.
          </p>

          <div className="mt-4 rounded-xl border border-[#dce4f7] bg-[#f8faff] p-4 text-sm text-[#435886]">
            {loadingPeriode ? "Memuat periode aktif..." : `Periode aktif: ${periodeAktif?.label_periode || "-"}`}
          </div>

          {pendaftaranDitutup ? (
            <div className="mt-3 rounded-lg border border-[#f3d4d4] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#a23b3b]">
              Periode pendaftaran masih belum dibuka oleh sekretaris prodi. Silakan coba lagi nanti.
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#40568a]">
            <span className={`rounded-full px-3 py-1 ${step === 1 ? "bg-[#2f63e3] text-white" : "bg-[#e8edf8] text-[#4f5f86]"}`}>
              1. Informasi Umum
            </span>
            <span className="text-[#95a4c7]"></span>
            <span className={`rounded-full px-3 py-1 ${step === 2 ? "bg-[#2f63e3] text-white" : "bg-[#e8edf8] text-[#4f5f86]"}`}>
              2. Form Lanjutan
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {step === 1 ? (
              <section className="rounded-xl border border-[#e1e7f4] bg-white p-4">
                <h2 className="text-lg font-black text-[#1a315f]">Informasi Umum</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#324c86]">Email UII (Otomatis)</label>
                    <input
                      name="email"
                      type="text"
                      value={formData.email}
                      readOnly
                      disabled
                      placeholder="Terisi otomatis dari NIM"
                      className="w-full rounded-lg border border-[#d0dbf4] bg-[#f4f7ff] px-3 py-2 text-sm text-[#5b6c91] outline-none"
                    />
                    <p className="mt-1 text-xs text-[#6477a8]">
                      Format otomatis: NIM@{MAHASISWA_EMAIL_DOMAIN}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#324c86]">NIM</label>
                    <input
                      name="nim"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{8}"
                      maxLength={8}
                      value={formData.nim}
                      onChange={handleChange}
                      placeholder="Contoh: 22523001"
                      className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#324c86]">Nama</label>
                    <input
                      name="nama"
                      type="text"
                      value={formData.nama}
                      onChange={handleChange}
                      maxLength={100}
                      placeholder="Nama mahasiswa"
                      className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                    />
                  </div>
                  {renderDosenSelect({
                    name: "dosen_pembimbing_akademik_id",
                    label: "Dosen Pembimbing Akademik",
                    value: formData.dosen_pembimbing_akademik_id,
                  })}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-[#324c86]">Pendaftaran</label>
                  {renderRadioGroup({
                    name: "pendaftaran",
                    value: formData.pendaftaran,
                    options: PENDAFTARAN_OPTIONS,
                  })}
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    {PENDAFTARAN_OPTIONS.map((option) => {
                      const isActive = formData.pendaftaran === option.value;
                      return (
                        <div
                          key={`keterangan-${option.value}`}
                          className={`rounded-lg border px-3 py-2 ${
                            isActive
                              ? "border-[#a9bff5] bg-[#f1f5ff]"
                              : "border-[#e2e8f6] bg-[#fbfcff]"
                          }`}
                        >
                          <p className="text-sm font-bold text-[#21396f]">{option.label}</p>
                          <p className="mt-1 text-xs text-[#53689a]">{option.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            {step === 2 && formData.pendaftaran === "baru" ? (
              <section className="rounded-xl border border-[#e1e7f4] bg-white p-4">
                <h2 className="text-lg font-black text-[#1a315f]">Form Lanjutan - Penjaluran Baru</h2>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-[#324c86]">Jenis jalur yang diambil</label>
                  {renderRadioGroup({
                    name: "jenis_jalur_diambil",
                    value: formData.jenis_jalur_diambil,
                    options: JALUR_OPTIONS,
                  })}
                </div>
                <div className="mt-4">
                  {renderDosenSelect({
                    name: "dosen_pembimbing_ta_id",
                    label: "Dosen Pembimbing TA",
                    value: formData.dosen_pembimbing_ta_id,
                    prioritizeNoBimbingan: true,
                    disableKuotaPenuh: true,
                    allowNoSupervisorOption: true,
                  })}
                </div>
              </section>
            ) : null}

            {step === 2 && formData.pendaftaran === "ulang" ? (
              <section className="rounded-xl border border-[#e1e7f4] bg-white p-4">
                <h2 className="text-lg font-black text-[#1a315f]">Form Lanjutan - Mengulang Jalur</h2>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-[#324c86]">Jenis jalur</label>
                  {renderRadioGroup({
                    name: "jenis_jalur_ulang",
                    value: formData.jenis_jalur_ulang,
                    options: JALUR_OPTIONS,
                  })}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderDosenSelect({
                    name: "dosen_pembimbing_ta_sebelumnya_id",
                    label: "Dosen Pembimbing TA Sebelumnya",
                    value: formData.dosen_pembimbing_ta_sebelumnya_id,
                  })}
                  {renderDosenSelect({
                    name: "dosen_pembimbing_ta_baru_id",
                    label: "Dosen Pembimbing TA yang Baru",
                    value: formData.dosen_pembimbing_ta_baru_id,
                    prioritizeNoBimbingan: true,
                    disableKuotaPenuh: true,
                    allowNoSupervisorOption: true,
                  })}
                </div>
              </section>
            ) : null}

            {step === 2 && formData.pendaftaran === "alih" ? (
              <section className="rounded-xl border border-[#e1e7f4] bg-white p-4">
                <h2 className="text-lg font-black text-[#1a315f]">Form Lanjutan - Pindah Jalur</h2>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-[#324c86]">Penjaluran sebelumnya</label>
                  {renderRadioGroup({
                    name: "penjaluran_sebelumnya",
                    value: formData.penjaluran_sebelumnya,
                    options: JALUR_OPTIONS,
                  })}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-[#324c86]">Penjaluran yang baru</label>
                  {renderRadioGroup({
                    name: "penjaluran_baru",
                    value: formData.penjaluran_baru,
                    options: JALUR_OPTIONS.map((option) =>
                      option.value === "pengabdian"
                        ? { ...option, label: "Pengabdian Masyarakat" }
                        : option
                    ),
                  })}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderDosenSelect({
                    name: "dosen_pembimbing_ta_sebelumnya_id",
                    label: "Dosen Pembimbing TA Sebelumnya",
                    value: formData.dosen_pembimbing_ta_sebelumnya_id,
                  })}
                  {renderDosenSelect({
                    name: "dosen_pembimbing_ta_baru_id",
                    label: "Dosen Pembimbing TA yang Baru",
                    value: formData.dosen_pembimbing_ta_baru_id,
                    prioritizeNoBimbingan: true,
                    disableKuotaPenuh: true,
                    allowNoSupervisorOption: true,
                  })}
                </div>
              </section>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a33f3f]">{error}</div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cfd9f2] bg-white px-4 py-2 text-sm font-bold text-[#23408c] transition hover:bg-[#f4f7ff]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke Login
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={pendaftaranDitutup}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1e45b0] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Lanjutkan
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cfd9f2] bg-white px-4 py-2 text-sm font-bold text-[#23408c] transition hover:bg-[#f4f7ff]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || pendaftaranDitutup}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1e45b0] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSubmitting ? "Mengirim..." : "Submit"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PendaftaranJalurPage;

