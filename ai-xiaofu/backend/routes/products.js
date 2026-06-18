const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');
const {
  badRequest,
  clampNumber,
  normalizePage,
  normalizeString,
  toInt,
  validateId,
  validateRequiredString
} = require('../middleware/validate');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

// ==================== 分类管理 ====================

router.get('/categories', adminAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM product_categories ORDER BY sort_order');
  res.json({ code: 200, data: rows });
});

router.post('/categories', adminAuth, async (req, res) => {
  const nameResult = validateRequiredString(req.body.name, '分类名', 100);
  if (!nameResult.ok) return badRequest(res, nameResult.message);
  const sortOrder = toInt(req.body.sort_order, 0);
  const [result] = await pool.query('INSERT INTO product_categories (name, sort_order) VALUES (?,?)', [nameResult.value, sortOrder]);
  res.json({ code: 200, data: { id: result.insertId }, message: '分类已添加' });
});

router.put('/categories/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '分类ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  const nameResult = validateRequiredString(req.body.name, '分类名', 100);
  if (!nameResult.ok) return badRequest(res, nameResult.message);
  const sortOrder = toInt(req.body.sort_order, 0);
  await pool.query('UPDATE product_categories SET name=?, sort_order=? WHERE id=?', [nameResult.value, sortOrder, idResult.value]);
  res.json({ code: 200, message: '分类已更新' });
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '分类ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  await pool.query('UPDATE products SET category_id=NULL WHERE category_id=?', [idResult.value]);
  await pool.query('DELETE FROM product_categories WHERE id=?', [idResult.value]);
  res.json({ code: 200, message: '分类已删除' });
});

// ==================== 产品CRUD ====================

router.get('/', adminAuth, async (req, res) => {
  const { page, limit, offset } = normalizePage(req.query);
  const categoryId = req.query.category_id ? validateId(req.query.category_id, '分类ID') : null;
  if (categoryId && !categoryId.ok) return badRequest(res, categoryId.message);
  const keyword = normalizeString(req.query.keyword, 100);

  let sql = 'SELECT p.*, pc.name as category_name FROM products p LEFT JOIN product_categories pc ON p.category_id=pc.id WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM products p WHERE 1=1';
  const params = [];
  const countParams = [];

  if (categoryId) { sql += ' AND p.category_id=?'; countSql += ' AND p.category_id=?'; params.push(categoryId.value); countParams.push(categoryId.value); }
  if (keyword) { sql += ' AND p.name LIKE ?'; countSql += ' AND p.name LIKE ?'; params.push(`%${keyword}%`); countParams.push(`%${keyword}%`); }

  sql += ' ORDER BY p.is_active DESC, p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  const [[{ total }]] = await pool.query(countSql, countParams);
  res.json({ code: 200, data: { list: rows, total, page } });
});

// 公开获取已启用产品（小程序端调用，无需登录）
router.get('/public', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT p.*, pc.name as category_name FROM products p LEFT JOIN product_categories pc ON p.category_id=pc.id WHERE p.is_active=1 ORDER BY pc.sort_order, p.id'
  );
  res.json({ code: 200, data: rows });
});

router.post('/', adminAuth, async (req, res) => {
  const nameResult = validateRequiredString(req.body.name, '产品名称', 200);
  if (!nameResult.ok) return badRequest(res, nameResult.message);
  const categoryId = req.body.category_id ? validateId(req.body.category_id, '分类ID') : { ok: true, value: null };
  if (!categoryId.ok) return badRequest(res, categoryId.message);
  const standardPrice = clampNumber(req.body.standard_price, 0, 99999999, 0);
  const discountPrice = clampNumber(req.body.discount_price, 0, 99999999, 0);
  const description = normalizeString(req.body.description, 5000);
  const includedServices = normalizeString(req.body.included_services, 5000);
  const excludedServices = normalizeString(req.body.excluded_services, 5000);
  const deliveryDays = normalizeString(req.body.delivery_days, 50);
  const afterSales = normalizeString(req.body.after_sales, 200);
  const isActive = req.body.is_active === 0 || req.body.is_active === false ? 0 : 1;

  const [result] = await pool.query(
    `INSERT INTO products (category_id, name, description, standard_price, discount_price, included_services, excluded_services, faq, delivery_days, after_sales, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [categoryId.value, nameResult.value, description, standardPrice, discountPrice, includedServices, excludedServices, JSON.stringify(req.body.faq || {}), deliveryDays, afterSales, isActive]
  );
  res.json({ code: 200, data: { id: result.insertId }, message: '产品已添加' });
});

router.put('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '产品ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  const nameResult = validateRequiredString(req.body.name, '产品名称', 200);
  if (!nameResult.ok) return badRequest(res, nameResult.message);
  const categoryId = req.body.category_id ? validateId(req.body.category_id, '分类ID') : { ok: true, value: null };
  if (!categoryId.ok) return badRequest(res, categoryId.message);
  const standardPrice = clampNumber(req.body.standard_price, 0, 99999999, 0);
  const discountPrice = clampNumber(req.body.discount_price, 0, 99999999, 0);
  const isActive = req.body.is_active === 0 || req.body.is_active === false ? 0 : 1;

  await pool.query(
    `UPDATE products SET category_id=?, name=?, description=?, standard_price=?, discount_price=?, included_services=?, excluded_services=?, faq=?, delivery_days=?, after_sales=?, is_active=? WHERE id=?`,
    [categoryId.value, nameResult.value, normalizeString(req.body.description, 5000), standardPrice, discountPrice, normalizeString(req.body.included_services, 5000), normalizeString(req.body.excluded_services, 5000), JSON.stringify(req.body.faq || {}), normalizeString(req.body.delivery_days, 50), normalizeString(req.body.after_sales, 200), isActive, idResult.value]
  );
  res.json({ code: 200, message: '产品已更新' });
});

router.delete('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '产品ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  await pool.query('DELETE FROM products WHERE id=?', [idResult.value]);
  res.json({ code: 200, message: '产品已删除' });
});

router.put('/:id/toggle', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '产品ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  const [rows] = await pool.query('SELECT is_active FROM products WHERE id=?', [idResult.value]);
  if (rows.length === 0) return res.json({ code: 404, message: '产品不存在' });
  const newStatus = rows[0].is_active ? 0 : 1;
  await pool.query('UPDATE products SET is_active=? WHERE id=?', [newStatus, idResult.value]);
  res.json({ code: 200, data: { is_active: newStatus }, message: newStatus ? '产品已上架' : '产品已下架' });
});

// ==================== Excel批量导入/导出 ====================

// 导出
router.get('/export', adminAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT p.name, pc.name as category, p.description, p.standard_price, p.discount_price, p.included_services, p.excluded_services, p.delivery_days, p.after_sales, p.is_active FROM products p LEFT JOIN product_categories pc ON p.category_id=pc.id'
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '产品库');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
  res.send(buf);
});

// 导入
router.post('/import', adminAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return badRequest(res, '请上传Excel文件');
  if (!/\.(xlsx|xls)$/i.test(req.file.originalname || '')) return badRequest(res, '仅支持 .xlsx 或 .xls 文件');
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    let imported = 0;
    for (const row of data) {
      if (!row['name'] && !row['产品名称']) continue;

      // 查找分类
      const catName = row['category'] || row['分类'] || '';
      let categoryId = null;
      if (catName) {
        const [cats] = await pool.query('SELECT id FROM product_categories WHERE name=?', [catName]);
        if (cats.length > 0) categoryId = cats[0].id;
      }

      await pool.query(
        `INSERT INTO products (name, category_id, description, standard_price, discount_price, included_services, excluded_services, delivery_days, after_sales)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          row['name'] || row['产品名称'],
          categoryId,
          row['description'] || row['详细服务介绍'] || '',
          parseFloat(row['standard_price'] || row['标准售价']) || 0,
          parseFloat(row['discount_price'] || row['优惠价']) || 0,
          row['included_services'] || row['包含服务项'] || '',
          row['excluded_services'] || row['不包含服务项'] || '',
          row['delivery_days'] || row['交付周期'] || '',
          row['after_sales'] || row['售后保障'] || ''
        ]
      );
      imported++;
    }
    res.json({ code: 200, message: `成功导入 ${imported} 条产品` });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, message: '导入失败：' + err.message });
  }
});

module.exports = router;
