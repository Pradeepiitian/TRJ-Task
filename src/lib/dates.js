const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(str) {
  if (!DATE_RE.test(str)) {
    return null;
  }

  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }

  return dt;
}

function eachUtcDay(startStr, endStr) {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  const days = [];
  const cur = new Date(start);

  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return days;
}

function dayStartMs(dateStr) {
  return parseDate(dateStr).getTime();
}

function dayEndMs(dateStr) {
  const d = parseDate(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d.getTime();
}

function msRange(startStr, endStr) {
  return { startMs: dayStartMs(startStr), endMs: dayEndMs(endStr) };
}

function utcDateFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

module.exports = {
  DATE_RE,
  parseDate,
  eachUtcDay,
  dayStartMs,
  dayEndMs,
  msRange,
  utcDateFromMs,
};
