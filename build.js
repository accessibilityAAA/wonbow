const fs = require('fs');
const path = require('path');

const productsFilePath = path.join(__dirname, 'js', 'products.js');
const templatePath = path.join(__dirname, 'template.html');
const outputDir = path.join(__dirname, 'product');
const sitemapPath = path.join(__dirname, 'sitemap.xml');
const searchIndexPath = path.join(__dirname, 'js', 'search-index.js');
const imagesDir = path.join(__dirname, 'images');

if (!fs.existsSync(productsFilePath) || !fs.existsSync(templatePath)) {
    console.error("❌ 防呆攔截：核心檔案缺失！");
    process.exit(1);
}

let productsData = [];
try {
    delete require.cache[require.resolve('./js/products.js')];
    const productsModule = require('./js/products.js');
    productsData = productsModule.ALL_PRODUCTS || [];
} catch (e) {
    console.error("❌ 防呆攔截：載入 js/products.js 失敗！", e.message);
    process.exit(1);
}

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const template = fs.readFileSync(templatePath, 'utf-8');
const today = new Date().toISOString().split('T')[0];

let count = 0;
let productUrlsXml = '';
let searchIndexData = [];

productsData.forEach((product) => {
    const priceNum = String(product.price || '').replace(/[^\d.]/g, '') || '0';
    const imgName = String(product.img || `${product.id}.jpg`);
    const fileName = String(product.id || '');

    let badges = [];
    if (product.isEco) badges.push('🌱 環保標章');
    if (product.isTaiwan) badges.push('🇹🇼 台灣製 (MIT)');
    if (product.isNonChina) badges.push('🛡️ 非陸製3C');
    if (product.govProcurement && product.govProcurement !== '否') badges.push('🏛️ 適合公家採購');
    const badgeText = badges.length > 0 ? badges.join(' ｜ ') : '一般合格商品';

    let htmlContent = template
        .replace(/{{ID}}/g, String(product.id || ''))
        .replace(/{{TITLE}}/g, String(product.title || ''))
        .replace(/{{BRAND}}/g, String(product.brand || '通用'))
        .replace(/{{MODEL}}/g, String(product.model || '無'))
        .replace(/{{PRICE}}/g, String(product.price === '洽詢' ? '洽詢' : (product.price ? product.price + '元' : '洽詢')))
        .replace(/{{PRICE_NUM}}/g, priceNum)
        .replace(/{{CODE}}/g, String(product.code || '未提供'))
        .replace(/{{CATEGORY}}/g, String(product.categoryCode || ''))
        .replace(/{{CATEGORY_NAME}}/g, String(product.categoryName || ''))
        .replace(/{{SPEC}}/g, String(product.spec || '原廠標準規格'))
        .replace(/{{ORIGIN}}/g, String(product.origin || '未標記'))
        .replace(/{{SUPPLIER}}/g, String(product.supplier || '萬寶屋創意實業社'))
        .replace(/{{BADGES}}/g, badgeText)
        .replace(/{{DESC}}/g, String(product.desc || '此商品符合國際標準規範，具備優異品質。'))
        .replace(/{{IMAGE}}/g, imgName);

    fs.writeFileSync(path.join(outputDir, `${fileName}.html`), htmlContent, 'utf-8');
    count++;

    productUrlsXml += `    <url>\n        <loc>https://www.oneball.com/product/${fileName}.html</loc>\n        <lastmod>${today}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.7</priority>\n    </url>\n`;

    searchIndexData.push({
        id: String(product.id || ''),
        fileName: `${fileName}.html`,
        title: String(product.title || ''),
        brand: String(product.brand || ''),
        model: String(product.model || ''),
        price: String(product.price || ''),
        code: String(product.code || ''),
        category: String(product.categoryCode || ''),
        aliases: Array.isArray(product.aliases) ? product.aliases : [],
        isEco: !!product.isEco,
        isTaiwan: !!product.isTaiwan,
        isNonChina: !!product.isNonChina,
        isNew: !!product.isNew
    });
});

const searchIndexJsContent = `/* ★ 全站智慧搜尋輕量索引 - 生成時間：${new Date().toLocaleString()} */\nconst SEARCH_INDEX = ${JSON.stringify(searchIndexData)};\nif (typeof window !== "undefined") { window.SEARCH_INDEX = SEARCH_INDEX; }`;
fs.writeFileSync(searchIndexPath, searchIndexJsContent, 'utf-8');

const fullSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://www.oneball.com/index.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://www.oneball.com/category.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>
    <url>
        <loc>https://www.oneball.com/sitemap.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://www.oneball.com/llms.txt</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
${productUrlsXml}</urlset>`;

fs.writeFileSync(sitemapPath, fullSitemapXml, 'utf-8');

console.log(`🎉 成功刷出 ${count} 個實體商品 HTML 頁面 (/product/*.html)！`);