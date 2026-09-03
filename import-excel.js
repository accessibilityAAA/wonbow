const fs = require('fs');
const path = require('path');

let XLSX;
try {
    XLSX = require('xlsx');
} catch (e) {
    console.error("❌ 找不到 'xlsx' 套件！請執行：npm install xlsx");
    process.exit(1);
}

const excelPath = path.join(__dirname, 'products.xlsx');
const jsDir = path.join(__dirname, 'js');
const productsJsPath = path.join(jsDir, 'products.js');

if (!fs.existsSync(excelPath)) {
    console.error("❌ 防呆攔截：找不到 products.xlsx 檔案！請確認檔案放在專案根目錄。");
    process.exit(1);
}

if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
}

console.log("📖 正在讀取 Excel 檔案：products.xlsx ...");

let workbook;
try {
    workbook = XLSX.readFile(excelPath, { cellDates: false, raw: false });
} catch (e) {
    console.error("❌ 防呆攔截：Excel 讀取失敗，檔案可能已被開啟或損壞！", e.message);
    process.exit(1);
}

const sheetName = workbook.SheetNames.includes('精選校園商品主檔(精簡高毛利)') ? '精選校園商品主檔(精簡高毛利)' : workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

if (!matrix || matrix.length === 0) {
    console.error("❌ 防呆攔截：Excel 工作表內容為空！");
    process.exit(1);
}

const HEADER_ALIASES = {
    id: ['id', '商品id', '商品ID', '商品編號', '產品id', '產品編號'],
    canPublish: ['可公告', '可上架', '上架', '網站公告', '發布'],
    categoryCode: ['分類代碼', '分類', 'category', 'categorycode'],
    categoryName: ['分類名稱', 'categoryname'],
    title: ['title', '商品名稱', '品名', '產品名稱'],
    brand: ['品牌', 'brand'],
    model: ['原廠型號', '型號', 'model'],
    spec: ['規格', '商品規格', 'spec'],
    price: ['價格', '售價', '現價', 'price'],
    originalPrice: ['原價', '定價', 'originalprice'],
    priceType: ['價格類型', 'pricetype'],
    code: ['EAN', '條碼', '條碼/EAN', '國際條碼', 'code', 'barcode'],
    origin: ['產地', '製造地', 'origin'],
    originProof: ['產地證明', 'originproof'],
    isNonChina: ['非陸製3C', '非陸製', 'isnonchina'],
    supplier: ['來源供應商', '供應商', 'supplier'],
    sourceUrl: ['來源網址', '商品網址', 'sourceurl'],
    checkDate: ['查價日期', 'checkdate'],
    govSuitability: ['採購適合度', 'govsuitability'],
    hotSort: ['熱銷排序', 'hotsort'],
    govProcurement: ['公家採購', 'govprocurement'],
    isEco: ['環保', '環保商品', '環保標章', 'iseco'],
    isTaiwan: ['台灣製', '臺灣製', 'MIT', 'istaiwan'],
    desc: ['商品描述', '描述', 'desc'],
    aliases: ['關鍵字', '搜尋關鍵字', 'aliases'],
    isNew: ['新品', 'isnew'],
    note: ['備註', 'note']
};

function normalizeHeader(value) {
    return String(value ?? '').trim().replace(/\s+/g, '').replace(/[（）]/g, '');
}

function findHeaderRow(rows) {
    for (let r = 0; r < Math.min(rows.length, 20); r++) {
        const headers = rows[r].map(normalizeHeader);
        const hasId = headers.some(h => HEADER_ALIASES.id.includes(h));
        const hasTitle = headers.some(h => HEADER_ALIASES.title.includes(h));
        if (hasId && hasTitle) return r;
    }
    return -1;
}

const headerRowIndex = findHeaderRow(matrix);
if (headerRowIndex === -1) {
    console.error("❌ 防呆攔截：找不到 Excel 標題列！請確認表格含有 '商品ID' 與 '商品名稱' 標題。");
    process.exit(1);
}

const rawHeaders = matrix[headerRowIndex];
const headerMap = {};
for (let c = 0; c < rawHeaders.length; c++) {
    const header = normalizeHeader(rawHeaders[c]);
    if (!header) continue;
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(header)) {
            headerMap[key] = c;
            break;
        }
    }
}

function getCell(row, key) {
    const index = headerMap[key];
    return index === undefined ? '' : String(row[index] ?? '').trim();
}

function getBoolean(value) {
    const v = String(value ?? '').trim().toUpperCase();
    return value === true || value === 1 || ['TRUE', 'YES', 'Y', '是', '1'].includes(v);
}

function sanitizePrice(rawPrice) {
    const text = String(rawPrice ?? '').trim();
    if (!text) return '洽詢';
    const cleanNum = text.replace(/[^\d.]/g, '');
    const num = parseFloat(cleanNum);
    if (isNaN(num) || num <= 0) return '洽詢';
    return `${num}`;
}

function normalizeCategoryCode(code, title) {
    let cleanCode = String(code || '').trim();
    if (cleanCode.length === 1) cleanCode = '0' + cleanCode + '_00';
    if (cleanCode.length === 2 && !cleanCode.includes('_')) cleanCode = cleanCode + '_00';
    
    if (!cleanCode) {
        if (title.includes('修繕') || title.includes('五金') || title.includes('水電')) return '02_00';
        if (title.includes('隨身碟') || title.includes('記憶卡') || title.includes('3C')) return '03_00';
        if (title.includes('影印紙') || title.includes('釘書機') || title.includes('剪刀')) return '04_00';
        if (title.includes('筆記本') || title.includes('文件') || title.includes('資料袋')) return '05_00';
        if (title.includes('童玩') || title.includes('角落')) return '06_00';
        return '01_00';
    }
    return cleanCode;
}

const dataRows = matrix.slice(headerRowIndex + 1).filter(row => row.some(cell => String(cell ?? '').trim() !== ''));

const allProducts = [];
const publishProducts = [];
const seenIds = new Set();
let skippedCount = 0;

dataRows.forEach((row, index) => {
    const id = getCell(row, 'id');
    const title = getCell(row, 'title');

    if (!id || !title) {
        skippedCount++;
        return;
    }

    if (seenIds.has(id)) {
        skippedCount++;
        return;
    }
    seenIds.add(id);

    const canPublish = getBoolean(getCell(row, 'canPublish'));
    const rawPrice = getCell(row, 'price');
    const safePrice = sanitizePrice(rawPrice);
    const rawCateCode = getCell(row, 'categoryCode');
    const safeCateCode = normalizeCategoryCode(rawCateCode, title);

    const product = {
        id: id,
        canPublish: canPublish,
        categoryCode: safeCateCode,
        categoryName: getCell(row, 'categoryName'),
        title: title,
        brand: getCell(row, 'brand'),
        model: getCell(row, 'model'),
        spec: getCell(row, 'spec'),
        price: safePrice,
        originalPrice: getCell(row, 'originalPrice'),
        priceType: getCell(row, 'priceType'),
        code: getCell(row, 'code'),
        origin: getCell(row, 'origin'),
        originProof: getCell(row, 'originProof'),
        isNonChina: getBoolean(getCell(row, 'isNonChina')),
        supplier: getCell(row, 'supplier'),
        sourceUrl: getCell(row, 'sourceUrl'),
        checkDate: getCell(row, 'checkDate'),
        govSuitability: getCell(row, 'govSuitability'),
        hotSort: getCell(row, 'hotSort'),
        govProcurement: getCell(row, 'govProcurement'),
        isEco: getBoolean(getCell(row, 'isEco')),
        isTaiwan: getBoolean(getCell(row, 'isTaiwan')),
        desc: getCell(row, 'desc'),
        aliases: String(getCell(row, 'aliases')).split(/[,，、]/).map(s => s.trim()).filter(Boolean),
        isNew: getBoolean(getCell(row, 'isNew')),
        note: getCell(row, 'note')
    };

    allProducts.push(product);
    if (canPublish) {
        publishProducts.push(product);
    }
});

const CATE_MAP = {
    "new": "★ 新品上市",
    "01_00": "1. 文具與美術教具",
    "02_00": "2. 水電材料與修繕五金",
    "03_00": "3. 3C 數位與電腦週邊",
    "04_00": "4. 事務機器與辦公耗材",
    "05_00": "5. 紙品帳簿與收納用品",
    "06_00": "6. 本土童玩與懷舊民俗",
    "07_00": "7. 其他綜合商品"
};

const HOT_KEYWORDS = ["黑筆", "藍筆", "紅筆", "修正帶", "隨身碟", "影印紙", "Double A", "創見", "羅技", "三菱", "百樂", "台灣文具", "臺灣文具"];

const newProductsJsContent = `/* ★ 從 Excel (products.xlsx) 全面升級匯入 - 生成時間：${new Date().toLocaleString('zh-TW')} */

const CATE_MAP = ${JSON.stringify(CATE_MAP, null, 4)};
const HOT_KEYWORDS = ${JSON.stringify(HOT_KEYWORDS, null, 4)};

const ALL_PRODUCTS = ${JSON.stringify(allProducts, null, 4)};
const PUBLISHED_PRODUCTS = ${JSON.stringify(publishProducts, null, 4)};

if (typeof window !== "undefined") {
    window.CATE_MAP = CATE_MAP;
    window.HOT_KEYWORDS = HOT_KEYWORDS;
    window.ALL_PRODUCTS = ALL_PRODUCTS;
    window.PUBLISHED_PRODUCTS = PUBLISHED_PRODUCTS;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        CATE_MAP,
        HOT_KEYWORDS,
        ALL_PRODUCTS,
        PUBLISHED_PRODUCTS
    };
}
`;

try {
    fs.writeFileSync(productsJsPath, newProductsJsContent, 'utf8');
    console.log(`\n==============================================`);
    console.log(`🎉 Excel 資料防呆轉換完成！`);
    console.log(`📦 全部商品數：${allProducts.length} 筆`);
    console.log(`🌐 成功上架發布商品數：${publishProducts.length} 筆`);
    console.log(`📄 產出檔案路徑：${productsJsPath}`);
    console.log(`==============================================\n`);
} catch (err) {
    console.error("❌ 防呆攔截：寫入 js/products.js 失敗！", err.message);
    process.exit(1);
}