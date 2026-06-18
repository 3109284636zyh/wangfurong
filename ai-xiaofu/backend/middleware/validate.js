/**
 * 轻量输入验证工具
 * 不引入额外依赖，保持当前项目部署简单。
 */

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const n = toNumber(value, fallback);
  return Math.min(max, Math.max(min, n));
}

function normalizePage(query) {
  const page = Math.max(1, toInt(query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(query.limit, 50)));
  return { page, limit, offset: (page - 1) * limit };
}

function validateId(id, fieldName = 'ID') {
  const n = toInt(id, 0);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: `${fieldName}不合法` };
  }
  return { ok: true, value: n };
}

function normalizeString(value, maxLength, fallback = '') {
  const text = value === undefined || value === null ? fallback : String(value).trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function validateRequiredString(value, label, maxLength) {
  const text = normalizeString(value, maxLength);
  if (!text) return { ok: false, message: `${label}不能为空` };
  return { ok: true, value: text };
}

function validateUrl(value, label = 'URL') {
  const text = normalizeString(value, 500);
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, message: `${label}必须是HTTP或HTTPS地址` };
    }
    return { ok: true, value: text };
  } catch (e) {
    return { ok: false, message: `${label}格式不正确` };
  }
}

function badRequest(res, message) {
  return res.status(400).json({ code: 400, message });
}

module.exports = {
  isPlainObject,
  toNumber,
  toInt,
  clampNumber,
  normalizePage,
  validateId,
  normalizeString,
  validateRequiredString,
  validateUrl,
  badRequest
};
