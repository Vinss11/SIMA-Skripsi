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
const PROGRAM_KULIAH_OPTIONS = [
  {
    value: "reguler",
    label: "Program Reguler",
  },
  {
    value: "internasional",
    label: "International Program",
  },
];
const PERAN_TIM_OPTIONS = [
  { value: "hustler", label: "Hustler" },
  { value: "hipster", label: "Hipster" },
  { value: "hacker", label: "Hacker" },
];
const MAHASISWA_EMAIL_DOMAIN = "students.uii.ac.id";
const NIM_REGEX = /^\d{2}523\d{3}$/;
const NAMA_REGEX = /^[a-zA-Z\s'.-]+$/;
const getNimValidationError = (nim) => {
  const normalizedNim = String(nim || "").trim();
  if (!normalizedNim) return "NIM wajib diisi.";
  if (!NIM_REGEX.test(normalizedNim)) {
    return "NIM tidak valid. Gunakan format YY523NNN, contoh 22523001.";
  }
  return "";
};
const getNamaValidationError = (nama) => {
  const normalizedNama = String(nama || "").trim();
  if (!normalizedNama) return "Nama wajib diisi.";
  if (normalizedNama.length < 2 || normalizedNama.length > 100) {
    return "Nama wajib 2 sampai 100 karakter.";
  }
  if (!NAMA_REGEX.test(normalizedNama)) {
    return "Nama hanya boleh berisi huruf, spasi, titik, apostrof, dan tanda hubung.";
  }
  return "";
};
const buildMahasiswaEmailFromNim = (nim) =>
  nim && nim.length > 0 ? `${nim}@${MAHASISWA_EMAIL_DOMAIN}`.toLowerCase() : "";
const createAnggotaPerintisan = () => ({
  jenis_pendaftaran: "baru",
  peran_tim: "",
  mahasiswa_id: "",
  nim: "",
  nama: "",
  dosen_pembimbing_akademik_id: "",
  mahasiswa: null,
});

function PendaftaranJalurPage({ apiBaseUrl, onBack, onRegisterSuccess }) {
  const [periodeAktif, setPeriodeAktif] = useState(null);
  const [loadingPeriode, setLoadingPeriode] = useState(true);
  const [loadingDosen, setLoadingDosen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ nim: "", nama: "" });
  const [touchedFields, setTouchedFields] = useState({ nim: false, nama: false });
  const [nimAvailability, setNimAvailability] = useState("idle");
  const [dosenOptions, setDosenOptions] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    nim: "",
    nama: "",
    dosen_pembimbing_akademik_id: "",
    program_kuliah: "",
    pendaftaran: "baru",
    jenis_jalur_diambil: "",
    dosen_pembimbing_ta_mode: "pilih_dosen",
    dosen_pembimbing_ta_id: "",
    jenis_jalur_ulang: "",
    dosen_pembimbing_ta_sebelumnya_id: "",
    dosen_pembimbing_ta_baru_id: "",
    penjaluran_sebelumnya: "",
    penjaluran_baru: "",
    ketua_peran_tim: "",
    anggota_perintisan: [createAnggotaPerintisan(), createAnggotaPerintisan()],
  });
  const [dosenSearchQueryByField, setDosenSearchQueryByField] = useState({});
  const [debouncedDosenSearchQueryByField, setDebouncedDosenSearchQueryByField] = useState({});
  const [activeDosenSearchField, setActiveDosenSearchField] = useState("");
  const [anggotaSearchQueries, setAnggotaSearchQueries] = useState(["", ""]);
  const [anggotaSearchResults, setAnggotaSearchResults] = useState([[], []]);
  const [anggotaSearchLoading, setAnggotaSearchLoading] = useState([false, false]);
  const [anggotaDpaSearchQueries, setAnggotaDpaSearchQueries] = useState(["", ""]);
  const [activeAnggotaDpaIndex, setActiveAnggotaDpaIndex] = useState(null);
  const pendaftaranDitutup = !loadingPeriode && !periodeAktif;
  const selectedTargetJalur =
    formData.pendaftaran === "baru"
      ? formData.jenis_jalur_diambil
      : formData.pendaftaran === "ulang"
        ? formData.jenis_jalur_ulang
        : formData.penjaluran_baru;
  const isPerintisanBisnis = selectedTargetJalur === "perintisan_bisnis";

  useEffect(() => {
    const nim = String(formData.nim || "").trim();
    const structuralError = getNimValidationError(nim);
    if (structuralError) {
      setNimAvailability("idle");
      return undefined;
    }

    const controller = new AbortController();
    setNimAvailability("checking");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/pendaftaran/check-nim?nim=${encodeURIComponent(nim)}`,
          { signal: controller.signal }
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Gagal memeriksa NIM.");
        }
        if (data.data?.available) {
          setNimAvailability("available");
          setFieldErrors((prev) => ({
            ...prev,
            nim: prev.nim === "NIM sudah terdaftar." ? "" : prev.nim,
          }));
        } else {
          setNimAvailability("unavailable");
          setFieldErrors((prev) => ({ ...prev, nim: "NIM sudah terdaftar." }));
        }
      } catch (checkError) {
        if (checkError.name !== "AbortError") {
          setNimAvailability("idle");
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiBaseUrl, formData.nim]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDosenSearchQueryByField(dosenSearchQueryByField);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [dosenSearchQueryByField]);

  useEffect(() => {
    const timers = formData.anggota_perintisan.map((anggota, index) => {
      const query = String(anggotaSearchQueries[index] || "").trim();
      if (
        !isPerintisanBisnis ||
        anggota.jenis_pendaftaran === "baru" ||
        query.length < 2
      ) {
        setAnggotaSearchResults((prev) => {
          const next = [...prev];
          next[index] = [];
          return next;
        });
        return null;
      }

      return window.setTimeout(async () => {
        setAnggotaSearchLoading((prev) => {
          const next = [...prev];
          next[index] = true;
          return next;
        });
        try {
          const params = new URLSearchParams({
            q: query,
            jenis: anggota.jenis_pendaftaran,
          });
          const response = await fetch(
            `${apiBaseUrl}/api/pendaftaran/mahasiswa-perintisan?${params.toString()}`
          );
          const data = await response.json().catch(() => null);
          setAnggotaSearchResults((prev) => {
            const next = [...prev];
            next[index] = response.ok && data?.success && Array.isArray(data.data) ? data.data : [];
            return next;
          });
        } catch (searchError) {
          setAnggotaSearchResults((prev) => {
            const next = [...prev];
            next[index] = [];
            return next;
          });
        } finally {
          setAnggotaSearchLoading((prev) => {
            const next = [...prev];
            next[index] = false;
            return next;
          });
        }
      }, 300);
    });

    return () => timers.forEach((timer) => timer && window.clearTimeout(timer));
  }, [anggotaSearchQueries, apiBaseUrl, formData.anggota_perintisan, isPerintisanBisnis]);

  const setFormField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateAnggotaPerintisan = (index, patch) => {
    setFormData((prev) => {
      const anggota = [...prev.anggota_perintisan];
      anggota[index] = { ...anggota[index], ...patch };
      return { ...prev, anggota_perintisan: anggota };
    });
  };

  const getPeranTimYangDipakaiSelain = (target) => {
    const usedRoles = [];
    if (target !== "ketua" && formData.ketua_peran_tim) {
      usedRoles.push(formData.ketua_peran_tim);
    }
    formData.anggota_perintisan.forEach((item, index) => {
      if (target !== index && item.peran_tim) usedRoles.push(item.peran_tim);
    });
    return new Set(usedRoles);
  };

  const getAnggotaNimConflict = (index) => {
    const currentNim = String(formData.anggota_perintisan[index]?.nim || "").trim();
    if (!currentNim) return "";
    if (currentNim === String(formData.nim || "").trim()) {
      return "NIM ini sama dengan NIM ketua kelompok.";
    }
    const duplicateIndex = formData.anggota_perintisan.findIndex(
      (item, itemIndex) =>
        itemIndex !== index && String(item.nim || "").trim() === currentNim
    );
    return duplicateIndex >= 0
      ? `NIM ini sama dengan Anggota ${duplicateIndex + 1}.`
      : "";
  };

  const getPeranTimConflict = (target, value) => {
    if (!value) return "";
    return getPeranTimYangDipakaiSelain(target).has(value)
      ? "Peran ini sudah digunakan anggota kelompok lain."
      : "";
  };

  const formatAnggotaDpaLabel = (dosen) => {
    if (!dosen) return "";
    return `${dosen.nama || "-"} - NIK: ${dosen.nik || "-"}`;
  };

  const selectAnggotaDpa = (index, dosen) => {
    updateAnggotaPerintisan(index, {
      dosen_pembimbing_akademik_id: String(dosen.id),
    });
    setAnggotaDpaSearchQueries((prev) => {
      const next = [...prev];
      next[index] = formatAnggotaDpaLabel(dosen);
      return next;
    });
    setActiveAnggotaDpaIndex(null);
  };

  const handleJenisAnggotaChange = (index, value) => {
    updateAnggotaPerintisan(index, {
      ...createAnggotaPerintisan(),
      jenis_pendaftaran: value,
      peran_tim: formData.anggota_perintisan[index]?.peran_tim || "",
    });
    setAnggotaSearchQueries((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });
    setAnggotaSearchResults((prev) => {
      const next = [...prev];
      next[index] = [];
      return next;
    });
    setAnggotaDpaSearchQueries((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });
  };

  const selectExistingAnggota = (index, mahasiswa) => {
    if (!mahasiswa?.eligible) return;
    updateAnggotaPerintisan(index, {
      mahasiswa_id: String(mahasiswa.id),
      nim: mahasiswa.nim || "",
      nama: mahasiswa.nama || "",
      dosen_pembimbing_akademik_id: mahasiswa.dosen_pembimbing_akademik?.id
        ? String(mahasiswa.dosen_pembimbing_akademik.id)
        : "",
      mahasiswa,
    });
    setAnggotaSearchQueries((prev) => {
      const next = [...prev];
      next[index] = `${mahasiswa.nim} - ${mahasiswa.nama}`;
      return next;
    });
    setAnggotaSearchResults((prev) => {
      const next = [...prev];
      next[index] = [];
      return next;
    });
  };

  const clearDosenSearchField = (fieldName) => {
    setDosenSearchQueryByField((prev) => ({ ...prev, [fieldName]: "" }));
    setDebouncedDosenSearchQueryByField((prev) => ({ ...prev, [fieldName]: "" }));
    setActiveDosenSearchField((prev) => (prev === fieldName ? "" : prev));
  };

  const handleDosenPembimbingTaModeChange = (mode) => {
    setFormData((prev) => ({
      ...prev,
      dosen_pembimbing_ta_mode: mode,
      dosen_pembimbing_ta_id: mode === "belum_dapat" ? "" : prev.dosen_pembimbing_ta_id,
    }));
    if (mode === "belum_dapat") {
      clearDosenSearchField("dosen_pembimbing_ta_id");
    }
  };

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (name === "nim") {
      value = value.replace(/\D/g, "").slice(0, 8);
      const generatedEmail = buildMahasiswaEmailFromNim(value);
      setFormData((prev) => ({ ...prev, nim: value, email: generatedEmail }));
      setFieldErrors((prev) => ({
        ...prev,
        nim: touchedFields.nim || value.length === 8 ? getNimValidationError(value) : "",
      }));
      return;
    }

    if (name === "nama") {
      value = value.slice(0, 100);
      setFieldErrors((prev) => ({
        ...prev,
        nama: touchedFields.nama ? getNamaValidationError(value) : "",
      }));
    }

    if (name === "email") {
      return;
    }

    setFormField(name, value);
  };

  const handleFieldBlur = (fieldName) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
    if (fieldName === "nim") {
      setFieldErrors((prev) => ({
        ...prev,
        nim:
          nimAvailability === "unavailable"
            ? "NIM sudah terdaftar."
            : getNimValidationError(formData.nim),
      }));
    }
    if (fieldName === "nama") {
      setFieldErrors((prev) => ({
        ...prev,
        nama: getNamaValidationError(formData.nama),
      }));
    }
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
              if (
                ["jenis_jalur_diambil", "jenis_jalur_ulang", "penjaluran_baru"].includes(inputName) &&
                inputValue === "perintisan_bisnis"
              ) {
                window.setTimeout(() => {
                  document
                    .getElementById("kelompok-perintisan-bisnis")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }
            }}
            className="h-4 w-4 border-[#9cb0dc] text-[#2f63e3] focus:ring-[#2f63e3]"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );

  const getOrderedDosenOptions = ({ prioritizeNoBimbingan = false }) => {
    const prioritasNoBimbingan = prioritizeNoBimbingan
      ? dosenOptions.filter((dosen) => dosen.is_no_bimbingan && !dosen.is_kuota_penuh)
      : [];
    const dosenLainnya = prioritizeNoBimbingan
      ? dosenOptions.filter((dosen) => !(dosen.is_no_bimbingan && !dosen.is_kuota_penuh))
      : dosenOptions;
    return [...prioritasNoBimbingan, ...dosenLainnya];
  };

  const findSelectedDosenByValue = (selectedValue) => {
    const normalizedValue = String(selectedValue || "").trim();
    if (!normalizedValue) return null;
    return dosenOptions.find((dosen) => String(dosen.id) === normalizedValue) || null;
  };

  const formatDosenInputLabel = (dosen) => {
    if (!dosen) return "";
    const nama = String(dosen.nama || "").trim();
    const nik = String(dosen.nik || "").trim();
    if (nama && nik) return `${nama} - NIK: ${nik}`;
    if (nama) return nama;
    if (nik) return `NIK: ${nik}`;
    return "";
  };

  const handleDosenSearchQueryChange = (fieldName, value) => {
    setDosenSearchQueryByField((prev) => ({ ...prev, [fieldName]: value }));
    setFormData((prev) => {
      const selectedDosen = findSelectedDosenByValue(prev?.[fieldName]);
      if (!selectedDosen) return prev;
      const selectedLabel = formatDosenInputLabel(selectedDosen);
      if (String(value).trim().toLowerCase() === selectedLabel.trim().toLowerCase()) {
        return prev;
      }
      return { ...prev, [fieldName]: "" };
    });
  };

  const handleDosenSearchFocus = (fieldName) => {
    setActiveDosenSearchField(fieldName);
  };

  const handleDosenSearchBlur = (fieldName) => {
    window.setTimeout(() => {
      setActiveDosenSearchField((prev) => (prev === fieldName ? "" : prev));
    }, 120);
  };

  const handleSelectDosenOption = (fieldName, optionValue) => {
    const selectedDosen =
      typeof optionValue === "object" && optionValue ? optionValue : findSelectedDosenByValue(optionValue);
    const selectedId = typeof optionValue === "object" && optionValue ? optionValue.id : optionValue;
    const selectedLabel = formatDosenInputLabel(selectedDosen);
    setFormField(fieldName, String(selectedId));
    setDosenSearchQueryByField((prev) => ({ ...prev, [fieldName]: selectedLabel }));
    setDebouncedDosenSearchQueryByField((prev) => ({ ...prev, [fieldName]: selectedLabel }));
    setActiveDosenSearchField("");
  };

  const renderDosenSelect = ({
    name,
    label,
    value,
    disabled = false,
    prioritizeNoBimbingan = false,
    disableKuotaPenuh = false,
  }) => {
    const dropdownOptions = getOrderedDosenOptions({ prioritizeNoBimbingan });
    const searchValue = String(dosenSearchQueryByField?.[name] || "");
    const debouncedSearchValue = String(debouncedDosenSearchQueryByField?.[name] || "");
    const normalizedSearch = debouncedSearchValue.trim().toLowerCase();
    const normalizedRawSearch = searchValue.trim().toLowerCase();
    const isDebouncing = normalizedRawSearch.length > 0 && normalizedRawSearch !== normalizedSearch;

    const selectedDosen = findSelectedDosenByValue(value);
    const selectedLabel = formatDosenInputLabel(selectedDosen);

    const candidateRows = (() => {
      const rows = [];
      for (const dosen of dropdownOptions) {
        rows.push({
          id: dosen.id,
          nama: dosen.nama,
          nik: dosen.nik || null,
          kode_dosen: dosen.kode_dosen || null,
          email: dosen.email || null,
          is_kuota_penuh: Boolean(dosen.is_kuota_penuh),
        });
      }

      return rows
        .filter((row) => {
          if (!normalizedSearch) return true;
          const haystack = `${row.nama || ""} ${row.nik || ""} ${row.kode_dosen || ""} ${row.email || ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
        .slice(0, 8);
    })();

    const inputValue = searchValue || selectedLabel;
    const shouldShowResults =
      activeDosenSearchField === name &&
      searchValue.trim().length > 0 &&
      searchValue.trim().toLowerCase() !== selectedLabel.trim().toLowerCase();
    const isDisabledField = disabled || loadingDosen;

    return (
      <div>
        <label className="mb-1 block text-sm font-semibold text-[#324c86]">{label}</label>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            disabled={isDisabledField}
            onFocus={() => handleDosenSearchFocus(name)}
            onBlur={() => handleDosenSearchBlur(name)}
            onChange={(event) => handleDosenSearchQueryChange(name, event.target.value)}
            placeholder={loadingDosen ? "Memuat data dosen..." : "Cari nama atau NIK dosen"}
            className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm text-[#203462] outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20 disabled:bg-[#f2f5fc] disabled:text-[#8b95af]"
          />
          {shouldShowResults ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-48 overflow-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg">
              {isDebouncing ? (
                <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Mencari...</p>
              ) : candidateRows.length > 0 ? (
                candidateRows.map((row) => {
                  const isDisabledRow = disableKuotaPenuh && row.is_kuota_penuh;
                  return (
                    <button
                      key={`${name}-candidate-${row.id}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (isDisabledRow) return;
                        handleSelectDosenOption(name, row.id);
                      }}
                      disabled={isDisabledRow}
                      className={`flex w-full items-center justify-between border-b border-[#edf1fb] px-3 py-2 text-left text-sm last:border-b-0 ${
                        isDisabledRow
                          ? "cursor-not-allowed bg-[#f8fafc] text-[#98a3c0]"
                          : "text-[#213460] hover:bg-[#f4f7ff]"
                      }`}
                    >
                      <span className="font-semibold">{row.nama || "-"}</span>
                      <span className="text-xs">
                        {isDisabledRow ? "Kuota penuh" : `NIK: ${row.nik || "-"}`}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Dosen tidak ditemukan.</p>
              )}
            </div>
          ) : null}
        </div>
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
        dosen_pembimbing_ta_mode: "pilih_dosen",
        dosen_pembimbing_ta_id: "",
        penjaluran_sebelumnya: "",
        penjaluran_baru: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      jenis_jalur_diambil: "",
      dosen_pembimbing_ta_mode: "pilih_dosen",
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
      program_kuliah: "",
      pendaftaran: "baru",
      jenis_jalur_diambil: "",
      dosen_pembimbing_ta_mode: "pilih_dosen",
      dosen_pembimbing_ta_id: "",
      jenis_jalur_ulang: "",
      dosen_pembimbing_ta_sebelumnya_id: "",
      dosen_pembimbing_ta_baru_id: "",
      penjaluran_sebelumnya: "",
      penjaluran_baru: "",
      ketua_peran_tim: "",
      anggota_perintisan: [createAnggotaPerintisan(), createAnggotaPerintisan()],
    });
    setDosenSearchQueryByField({});
    setDebouncedDosenSearchQueryByField({});
    setActiveDosenSearchField("");
    setAnggotaSearchQueries(["", ""]);
    setAnggotaSearchResults([[], []]);
    setAnggotaDpaSearchQueries(["", ""]);
    setActiveAnggotaDpaIndex(null);
    setFieldErrors({ nim: "", nama: "" });
    setTouchedFields({ nim: false, nama: false });
    setNimAvailability("idle");
    setStep(1);
  };

  const validateKelompokPerintisan = () => {
    if (!formData.ketua_peran_tim) {
      return "Pilih peran tim untuk ketua kelompok.";
    }
    const roles = [
      formData.ketua_peran_tim,
      ...formData.anggota_perintisan.map((item) => item.peran_tim),
    ];
    if (
      roles.some((role) => !role) ||
      new Set(roles).size !== 3 ||
      !PERAN_TIM_OPTIONS.every((option) => roles.includes(option.value))
    ) {
      return "Kelompok wajib memiliki tepat satu Hustler, satu Hipster, dan satu Hacker.";
    }

    for (let index = 0; index < formData.anggota_perintisan.length; index += 1) {
      const anggota = formData.anggota_perintisan[index];
      const label = `Anggota ${index + 1}`;
      if (anggota.jenis_pendaftaran === "baru") {
        if (!NIM_REGEX.test(String(anggota.nim || "").trim())) {
          return `${label}: NIM wajib menggunakan format YY523NNN, contoh 22523001.`;
        }
        if (
          String(anggota.nama || "").trim().length < 2 ||
          !NAMA_REGEX.test(String(anggota.nama || "").trim())
        ) {
          return `${label}: nama mahasiswa tidak valid.`;
        }
        if (!anggota.dosen_pembimbing_akademik_id) {
          return `${label}: Dosen Pembimbing Akademik wajib dipilih.`;
        }
      } else if (!anggota.mahasiswa_id || !anggota.mahasiswa?.eligible) {
        return `${label}: pilih mahasiswa ${anggota.jenis_pendaftaran} yang memenuhi syarat dari master data.`;
      }
    }

    const nims = [
      formData.nim,
      ...formData.anggota_perintisan.map((item) => item.nim),
    ].map((item) => String(item || "").trim());
    if (new Set(nims).size !== 3) {
      return "Ketua dan kedua anggota harus merupakan mahasiswa yang berbeda.";
    }
    return "";
  };

  const validateStepOne = () => {
    const nim = formData.nim.trim();
    const nama = formData.nama.trim();
    const nimError =
      nimAvailability === "unavailable" ? "NIM sudah terdaftar." : getNimValidationError(nim);
    const namaError = getNamaValidationError(nama);
    setTouchedFields((prev) => ({ ...prev, nim: true, nama: true }));
    setFieldErrors({ nim: nimError, nama: namaError });

    if (nimError || namaError) {
      return "Periksa kembali NIM dan nama mahasiswa.";
    }
    if (nimAvailability === "checking") {
      return "Tunggu sebentar, NIM sedang diperiksa.";
    }
    if (!formData.dosen_pembimbing_akademik_id || !formData.program_kuliah) {
      return "Lengkapi Dosen Pembimbing Akademik dan program kuliah.";
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
      setError(commonError === "Periksa kembali NIM dan nama mahasiswa." ? "" : commonError);
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
      setError(commonError === "Periksa kembali NIM dan nama mahasiswa." ? "" : commonError);
      setStep(1);
      return;
    }

    if (formData.pendaftaran === "baru") {
      if (!formData.jenis_jalur_diambil) {
        setError("Lengkapi field lanjutan untuk jalur baru.");
        return;
      }
      if (
        !isPerintisanBisnis &&
        formData.dosen_pembimbing_ta_mode !== "belum_dapat" &&
        !formData.dosen_pembimbing_ta_id
      ) {
        setError("Pilih dosen pembimbing TA sementara atau pilih opsi belum mendapatkan dosen pembimbing.");
        return;
      }
    } else if (formData.pendaftaran === "ulang") {
      if (
        !formData.jenis_jalur_ulang ||
        (!isPerintisanBisnis &&
          (!formData.dosen_pembimbing_ta_sebelumnya_id ||
            !formData.dosen_pembimbing_ta_baru_id))
      ) {
        setError("Lengkapi field lanjutan untuk jalur ulang.");
        return;
      }
    } else if (formData.pendaftaran === "alih") {
      if (
        !formData.penjaluran_sebelumnya ||
        !formData.penjaluran_baru ||
        (!isPerintisanBisnis &&
          (!formData.dosen_pembimbing_ta_sebelumnya_id ||
            !formData.dosen_pembimbing_ta_baru_id))
      ) {
        setError("Lengkapi field lanjutan untuk jalur alih.");
        return;
      }
    }

    if (isPerintisanBisnis) {
      const kelompokError = validateKelompokPerintisan();
      if (kelompokError) {
        setError(kelompokError);
        return;
      }
    }

    const parseOptionalDosenId = (rawValue) => {
      if (!rawValue) return null;
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
          program_kuliah: formData.program_kuliah,
          pendaftaran: formData.pendaftaran,
          dosen_pembimbing_akademik_id: Number(formData.dosen_pembimbing_akademik_id),
          jenis_jalur_diambil: formData.jenis_jalur_diambil,
          jenis_jalur_ulang: formData.jenis_jalur_ulang,
          dosen_pembimbing_ta_id: parseOptionalDosenId(formData.dosen_pembimbing_ta_id),
          dosen_pembimbing_ta_sebelumnya_id: parseOptionalDosenId(formData.dosen_pembimbing_ta_sebelumnya_id),
          dosen_pembimbing_ta_baru_id: parseOptionalDosenId(formData.dosen_pembimbing_ta_baru_id),
          penjaluran_sebelumnya: formData.penjaluran_sebelumnya,
          penjaluran_baru: formData.penjaluran_baru,
          ketua_peran_tim: formData.ketua_peran_tim,
          anggota_perintisan: formData.anggota_perintisan.map((item) => ({
            jenis_pendaftaran: item.jenis_pendaftaran,
            peran_tim: item.peran_tim,
            mahasiswa_id: item.mahasiswa_id ? Number(item.mahasiswa_id) : null,
            nim: String(item.nim || "").trim(),
            nama: String(item.nama || "").trim(),
            dosen_pembimbing_akademik_id: item.dosen_pembimbing_akademik_id
              ? Number(item.dosen_pembimbing_akademik_id)
              : null,
          })),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const requestError = new Error(data?.message || "Pendaftaran gagal diproses.");
        requestError.field = data?.detail?.field || "";
        throw requestError;
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
      if (["nim", "nama"].includes(submitError.field)) {
        setTouchedFields((prev) => ({ ...prev, [submitError.field]: true }));
        setFieldErrors((prev) => ({
          ...prev,
          [submitError.field]: submitError.message || "Data tidak valid.",
        }));
        setStep(1);
        setError("");
      } else {
        setError(submitError.message || "Pendaftaran gagal diproses.");
      }
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
                      pattern="[0-9]{2}523[0-9]{3}"
                      maxLength={8}
                      value={formData.nim}
                      onChange={handleChange}
                      onBlur={() => handleFieldBlur("nim")}
                      placeholder="Contoh: 22523001"
                      aria-invalid={Boolean(fieldErrors.nim)}
                      aria-describedby={fieldErrors.nim ? "nim-error" : undefined}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                        fieldErrors.nim
                          ? "border-[#dc4c4c] focus:border-[#dc4c4c] focus:ring-[#dc4c4c]/15"
                          : "border-[#d0dbf4] focus:border-[#2f63e3] focus:ring-[#2f63e3]/20"
                      }`}
                    />
                    {fieldErrors.nim ? (
                      <p id="nim-error" className="mt-1 text-xs font-semibold text-[#c43f3f]">
                        {fieldErrors.nim}
                      </p>
                    ) : nimAvailability === "checking" ? (
                      <p className="mt-1 text-xs text-[#6477a8]">Memeriksa ketersediaan NIM...</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#324c86]">Nama</label>
                    <input
                      name="nama"
                      type="text"
                      value={formData.nama}
                      onChange={handleChange}
                      onBlur={() => handleFieldBlur("nama")}
                      maxLength={100}
                      placeholder="Nama mahasiswa"
                      aria-invalid={Boolean(fieldErrors.nama)}
                      aria-describedby={fieldErrors.nama ? "nama-error" : undefined}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                        fieldErrors.nama
                          ? "border-[#dc4c4c] focus:border-[#dc4c4c] focus:ring-[#dc4c4c]/15"
                          : "border-[#d0dbf4] focus:border-[#2f63e3] focus:ring-[#2f63e3]/20"
                      }`}
                    />
                    {fieldErrors.nama ? (
                      <p id="nama-error" className="mt-1 text-xs font-semibold text-[#c43f3f]">
                        {fieldErrors.nama}
                      </p>
                    ) : null}
                  </div>
                  {renderDosenSelect({
                    name: "dosen_pembimbing_akademik_id",
                    label: "Dosen Pembimbing Akademik",
                    value: formData.dosen_pembimbing_akademik_id,
                  })}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-[#324c86]">Program Kuliah</label>
                  {renderRadioGroup({
                    name: "program_kuliah",
                    value: formData.program_kuliah,
                    options: PROGRAM_KULIAH_OPTIONS,
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
                {!isPerintisanBisnis ? (
                  <>
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-[#324c86]">Status Dosen Pembimbing TA</label>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          {
                            value: "pilih_dosen",
                            label: "Sudah memiliki calon dosen pembimbing",
                          },
                          {
                            value: "belum_dapat",
                            label: "Belum mendapatkan dosen pembimbing",
                          },
                        ].map((option) => (
                          <label
                            key={`dosen-ta-mode-${option.value}`}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                              formData.dosen_pembimbing_ta_mode === option.value
                                ? "border-[#2f63e3] bg-[#eff4ff] text-[#173d9f]"
                                : "border-[#d8e0f3] bg-white text-[#2d3f6f]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="dosen_pembimbing_ta_mode"
                              value={option.value}
                              checked={formData.dosen_pembimbing_ta_mode === option.value}
                              onChange={(event) => handleDosenPembimbingTaModeChange(event.target.value)}
                              className="h-4 w-4 border-[#9cb0dc] text-[#2f63e3] focus:ring-[#2f63e3]"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#60709a]">
                        Jika belum mendapatkan dosen pembimbing, field dosen akan dikosongkan dan dapat ditentukan pada proses persetujuan berikutnya.
                      </p>
                    </div>
                    <div className="mt-4">
                      {renderDosenSelect({
                        name: "dosen_pembimbing_ta_id",
                        label: "Dosen Pembimbing TA Sementara",
                        value: formData.dosen_pembimbing_ta_id,
                        disabled: formData.dosen_pembimbing_ta_mode === "belum_dapat",
                        prioritizeNoBimbingan: true,
                        disableKuotaPenuh: true,
                      })}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 rounded-lg border border-[#d8e3fb] bg-[#f5f8ff] px-3 py-2 text-sm text-[#40598f]">
                    Dosen pembimbing kelompok akan ditetapkan pada proses Perintisan Bisnis berikutnya.
                  </p>
                )}
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
                {!isPerintisanBisnis ? (
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
                    })}
                  </div>
                ) : null}
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
                {!isPerintisanBisnis ? (
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
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}

            {step === 2 && isPerintisanBisnis ? (
              <section
                id="kelompok-perintisan-bisnis"
                className="scroll-mt-4 rounded-xl border border-[#9eb8f3] bg-white p-4 shadow-sm"
              >
                <h2 className="text-lg font-black text-[#1a315f]">Kelompok Perintisan Bisnis</h2>
                <p className="mt-1 text-sm text-[#5d6c91]">
                  Kelompok wajib terdiri dari satu ketua, dua anggota, serta satu Hustler, Hipster, dan Hacker.
                </p>

                <div className="mt-4 rounded-lg border border-[#dbe4f7] bg-[#f8faff] p-4">
                  <p className="text-xs font-bold uppercase text-[#7180a5]">Ketua Kelompok</p>
                  <p className="mt-1 font-bold text-[#1a315f]">{formData.nama || "-"}</p>
                  <p className="text-sm text-[#60709a]">{formData.nim || "-"}</p>
                  <label className="mt-3 block text-sm font-semibold text-[#324c86]">
                    Peran Tim
                    <select
                      value={formData.ketua_peran_tim}
                      onChange={(event) => setFormField("ketua_peran_tim", event.target.value)}
                      className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm ${
                        getPeranTimConflict("ketua", formData.ketua_peran_tim)
                          ? "border-[#d95c5c]"
                          : "border-[#d0dbf4]"
                      }`}
                    >
                      <option value="">Pilih peran ketua</option>
                      {PERAN_TIM_OPTIONS.map((option) => (
                        <option
                          key={`ketua-${option.value}`}
                          value={option.value}
                          disabled={getPeranTimYangDipakaiSelain("ketua").has(option.value)}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {getPeranTimConflict("ketua", formData.ketua_peran_tim) ? (
                      <span className="mt-1 block text-xs font-semibold text-[#b33f3f]">
                        {getPeranTimConflict("ketua", formData.ketua_peran_tim)}
                      </span>
                    ) : null}
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {formData.anggota_perintisan.map((anggota, index) => {
                    const isBaru = anggota.jenis_pendaftaran === "baru";
                    const nimConflict = getAnggotaNimConflict(index);
                    const roleConflict = getPeranTimConflict(index, anggota.peran_tim);
                    const selectedDpa = dosenOptions.find(
                      (dosen) =>
                        String(dosen.id) === String(anggota.dosen_pembimbing_akademik_id)
                    );
                    const dpaSearchValue =
                      anggotaDpaSearchQueries[index] || formatAnggotaDpaLabel(selectedDpa);
                    const normalizedDpaSearch = dpaSearchValue.trim().toLowerCase();
                    const filteredDpaOptions = dosenOptions
                      .filter((dosen) => {
                        if (!normalizedDpaSearch || selectedDpa) return true;
                        const haystack =
                          `${dosen.nama || ""} ${dosen.nik || ""} ${dosen.kode_dosen || ""} ${dosen.email || ""}`.toLowerCase();
                        return haystack.includes(normalizedDpaSearch);
                      })
                      .slice(0, 8);
                    return (
                      <div key={`anggota-perintisan-${index}`} className="rounded-lg border border-[#dbe4f7] p-4">
                        <h3 className="font-bold text-[#1a315f]">Anggota {index + 1}</h3>
                        <div className="mt-3 grid grid-cols-1 gap-3">
                          <label className="text-sm font-semibold text-[#324c86]">
                            Jenis Pendaftaran
                            <select
                              value={anggota.jenis_pendaftaran}
                              onChange={(event) => handleJenisAnggotaChange(index, event.target.value)}
                              className="mt-1 w-full rounded-lg border border-[#d0dbf4] bg-white px-3 py-2 text-sm"
                            >
                              {PENDAFTARAN_OPTIONS.map((option) => (
                                <option key={`anggota-${index}-${option.value}`} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm font-semibold text-[#324c86]">
                            Peran Tim
                            <select
                              value={anggota.peran_tim}
                              onChange={(event) => updateAnggotaPerintisan(index, { peran_tim: event.target.value })}
                              className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm ${
                                roleConflict ? "border-[#d95c5c]" : "border-[#d0dbf4]"
                              }`}
                            >
                              <option value="">Pilih peran anggota</option>
                              {PERAN_TIM_OPTIONS.map((option) => (
                                <option
                                  key={`anggota-role-${index}-${option.value}`}
                                  value={option.value}
                                  disabled={getPeranTimYangDipakaiSelain(index).has(option.value)}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {roleConflict ? (
                              <span className="mt-1 block text-xs font-semibold text-[#b33f3f]">
                                {roleConflict}
                              </span>
                            ) : null}
                          </label>

                          {isBaru ? (
                            <>
                              <label className="text-sm font-semibold text-[#324c86]">
                                NIM
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={8}
                                  value={anggota.nim}
                                  onChange={(event) =>
                                    updateAnggotaPerintisan(index, {
                                      nim: event.target.value.replace(/\D/g, "").slice(0, 8),
                                    })
                                  }
                                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                                    nimConflict ? "border-[#d95c5c]" : "border-[#d0dbf4]"
                                  }`}
                                />
                                {nimConflict ? (
                                  <span className="mt-1 block text-xs font-semibold text-[#b33f3f]">
                                    {nimConflict}
                                  </span>
                                ) : null}
                              </label>
                              <label className="text-sm font-semibold text-[#324c86]">
                                Nama
                                <input
                                  type="text"
                                  maxLength={100}
                                  value={anggota.nama}
                                  onChange={(event) =>
                                    updateAnggotaPerintisan(index, { nama: event.target.value.slice(0, 100) })
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm"
                                />
                              </label>
                              <div className="relative">
                                <label className="block text-sm font-semibold text-[#324c86]">
                                  Dosen Pembimbing Akademik
                                  <input
                                    type="text"
                                    value={dpaSearchValue}
                                    onFocus={() => setActiveAnggotaDpaIndex(index)}
                                    onBlur={() => {
                                      window.setTimeout(() => {
                                        setActiveAnggotaDpaIndex((current) =>
                                          current === index ? null : current
                                        );
                                      }, 120);
                                    }}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setAnggotaDpaSearchQueries((prev) => {
                                        const next = [...prev];
                                        next[index] = value;
                                        return next;
                                      });
                                      if (
                                        selectedDpa &&
                                        value.trim().toLowerCase() !==
                                          formatAnggotaDpaLabel(selectedDpa).toLowerCase()
                                      ) {
                                        updateAnggotaPerintisan(index, {
                                          dosen_pembimbing_akademik_id: "",
                                        });
                                      }
                                      setActiveAnggotaDpaIndex(index);
                                    }}
                                    placeholder="Cari nama atau NIK dosen"
                                    className="mt-1 w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                                  />
                                </label>
                                {activeAnggotaDpaIndex === index &&
                                (!selectedDpa ||
                                  dpaSearchValue.trim().toLowerCase() !==
                                    formatAnggotaDpaLabel(selectedDpa).toLowerCase()) ? (
                                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-auto rounded-lg border border-[#dbe4f7] bg-white shadow-lg">
                                    {filteredDpaOptions.length > 0 ? (
                                      filteredDpaOptions.map((dosen) => (
                                        <button
                                          key={`anggota-dpa-${index}-${dosen.id}`}
                                          type="button"
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => selectAnggotaDpa(index, dosen)}
                                          className="block w-full border-b border-[#edf1fb] px-3 py-2 text-left text-sm text-[#213460] last:border-0 hover:bg-[#f4f7ff]"
                                        >
                                          <span className="block font-semibold">{dosen.nama || "-"}</span>
                                          <span className="block text-xs text-[#6477a8]">
                                            NIK: {dosen.nik || "-"}
                                          </span>
                                        </button>
                                      ))
                                    ) : (
                                      <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">
                                        Dosen tidak ditemukan.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <div className="relative">
                              <label className="block text-sm font-semibold text-[#324c86]">
                                Cari Mahasiswa dari Master Data
                                <input
                                  type="text"
                                  value={anggotaSearchQueries[index]}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setAnggotaSearchQueries((prev) => {
                                      const next = [...prev];
                                      next[index] = value;
                                      return next;
                                    });
                                    updateAnggotaPerintisan(index, {
                                      mahasiswa_id: "",
                                      nim: "",
                                      nama: "",
                                      mahasiswa: null,
                                    });
                                  }}
                                  placeholder="Ketik NIM atau nama"
                                  className="mt-1 w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm"
                                />
                              </label>
                              {anggotaSearchQueries[index].trim().length >= 2 && !anggota.mahasiswa_id ? (
                                <div className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-[#dbe4f7] bg-white shadow-lg">
                                  {anggotaSearchLoading[index] ? (
                                    <p className="px-3 py-2 text-xs text-[#6477a8]">Mencari mahasiswa...</p>
                                  ) : anggotaSearchResults[index].length > 0 ? (
                                    anggotaSearchResults[index].map((item) => (
                                      <button
                                        key={`anggota-result-${index}-${item.id}`}
                                        type="button"
                                        disabled={!item.eligible}
                                        onClick={() => selectExistingAnggota(index, item)}
                                        className={`block w-full border-b border-[#edf1fb] px-3 py-2 text-left text-sm last:border-0 ${
                                          item.eligible
                                            ? "hover:bg-[#f4f7ff]"
                                            : "cursor-not-allowed bg-[#fafbfe] text-[#8b95af]"
                                        }`}
                                      >
                                        <span className="block font-semibold">{item.nim} - {item.nama}</span>
                                        <span className="block text-xs">
                                          {item.eligible
                                            ? `DPA: ${item.dosen_pembimbing_akademik?.nama || "-"}`
                                            : item.eligibility_reason}
                                        </span>
                                      </button>
                                    ))
                                  ) : (
                                    <p className="px-3 py-2 text-xs text-[#6477a8]">Mahasiswa tidak ditemukan.</p>
                                  )}
                                </div>
                              ) : null}
                              {anggota.mahasiswa ? (
                                <div className="mt-3 rounded-lg border border-[#dbe4f7] bg-[#f8faff] p-3 text-sm text-[#40598f]">
                                  <p><b>NIM:</b> {anggota.nim}</p>
                                  <p><b>Nama:</b> {anggota.nama}</p>
                                  <p><b>DPA:</b> {anggota.mahasiswa.dosen_pembimbing_akademik?.nama || "-"}</p>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {step === 2 && selectedTargetJalur ? (
              <section
                className={`rounded-xl border px-4 py-3 ${
                  isPerintisanBisnis
                    ? "border-[#a8c0f5] bg-[#f1f5ff] text-[#244795]"
                    : "border-[#dce4f7] bg-[#f8faff] text-[#40598f]"
                }`}
              >
                <p className="text-xs font-bold uppercase">Konfirmasi Jalur</p>
                <p className="mt-1 text-sm font-semibold">
                  Pendaftaran ini akan dikirim untuk jalur{" "}
                  <b>
                    {JALUR_OPTIONS.find((option) => option.value === selectedTargetJalur)?.label ||
                      selectedTargetJalur}
                  </b>.
                </p>
                {isPerintisanBisnis ? (
                  <p className="mt-1 text-xs">
                    Pastikan dua anggota, DPA anggota Baru, jenis pendaftaran anggota, serta peran
                    Hustler, Hipster, dan Hacker sudah lengkap.
                  </p>
                ) : null}
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
                    {isSubmitting
                      ? "Mengirim..."
                      : selectedTargetJalur
                        ? `Daftarkan ${
                            JALUR_OPTIONS.find((option) => option.value === selectedTargetJalur)
                              ?.label || "Jalur"
                          }`
                        : "Submit"}
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
