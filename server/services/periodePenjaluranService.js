const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeJakarta(value) {
  const date = toValidDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: JAKARTA_TIME_ZONE,
    timeZoneName: "short",
  }).format(date);
}

function parseInputDateForJakarta(value, boundary = "start") {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (DATE_ONLY_REGEX.test(raw)) {
    if (boundary === "end") {
      return toValidDate(`${raw}T23:59:59.999+07:00`);
    }
    return toValidDate(`${raw}T00:00:00.000+07:00`);
  }

  return toValidDate(raw);
}

function evaluatePeriodeWindow(periode, options = {}) {
  const now = toValidDate(options.now) || new Date();

  if (!periode) {
    return {
      is_open: false,
      reason: "not_found",
      now,
      start: null,
      end: null,
    };
  }

  if (periode.is_active !== true) {
    return {
      is_open: false,
      reason: "not_active",
      now,
      start: toValidDate(periode.tanggal_mulai),
      end: toValidDate(periode.tanggal_selesai),
    };
  }

  const start = toValidDate(periode.tanggal_mulai);
  const end = toValidDate(periode.tanggal_selesai);

  if (start && end && start.getTime() > end.getTime()) {
    return {
      is_open: false,
      reason: "invalid_range",
      now,
      start,
      end,
    };
  }

  if (start && now.getTime() < start.getTime()) {
    return {
      is_open: false,
      reason: "not_started",
      now,
      start,
      end,
    };
  }

  if (end && now.getTime() > end.getTime()) {
    return {
      is_open: false,
      reason: "ended",
      now,
      start,
      end,
    };
  }

  return {
    is_open: true,
    reason: "open",
    now,
    start,
    end,
  };
}

function getPeriodeWindowErrorCode(windowCheck) {
  switch (windowCheck?.reason) {
    case "not_started":
      return "PERIODE_BELUM_MULAI";
    case "ended":
      return "PERIODE_SUDAH_DITUTUP";
    case "invalid_range":
      return "PERIODE_TIDAK_VALID";
    case "not_active":
    case "not_found":
    default:
      return "PERIODE_NOT_ACTIVE";
  }
}

function getPeriodeWindowMessage(windowCheck) {
  if (!windowCheck || windowCheck.is_open) return "";

  if (windowCheck.reason === "not_started") {
    const startLabel = formatDateTimeJakarta(windowCheck.start);
    return startLabel
      ? `Periode pendaftaran belum dimulai. Pendaftaran dibuka pada ${startLabel}.`
      : "Periode pendaftaran belum dimulai.";
  }

  if (windowCheck.reason === "ended") {
    const endLabel = formatDateTimeJakarta(windowCheck.end);
    return endLabel
      ? `Periode pendaftaran sudah ditutup sejak ${endLabel}.`
      : "Periode pendaftaran sudah ditutup.";
  }

  if (windowCheck.reason === "invalid_range") {
    return "Jadwal periode tidak valid (tanggal mulai lebih besar dari tanggal selesai). Hubungi sekretaris prodi.";
  }

  return "Periode pendaftaran masih belum dibuka oleh sekretaris prodi.";
}

module.exports = {
  toValidDate,
  parseInputDateForJakarta,
  formatDateTimeJakarta,
  evaluatePeriodeWindow,
  getPeriodeWindowErrorCode,
  getPeriodeWindowMessage,
};
