import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TIMEOUT = 15000;

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
};

const CREDENTIALS = {
  admin: {
    email: requireEnv('SMOKE_ADMIN_EMAIL'),
    password: requireEnv('SMOKE_ADMIN_PASSWORD'),
  },
  vendor: {
    email: requireEnv('SMOKE_VENDOR_EMAIL'),
    password: requireEnv('SMOKE_VENDOR_PASSWORD'),
  },
};

const pass = (label, details = '') => console.log(`PASS ${label}${details ? ` -> ${details}` : ''}`);
const info = (label, details = '') => console.log(`INFO ${label}${details ? ` -> ${details}` : ''}`);
const fail = (label, error) => {
  console.error(`FAIL ${label}`);
  console.error(error instanceof Error ? error.message : String(error));
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

async function getFirstVisibleProductLink(page) {
  const links = page.locator('a[href^="/product/"]');
  const count = await links.count();

  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const visible = await link.isVisible().catch(() => false);
    if (!visible) continue;

    const href = await link.getAttribute('href');
    if (!href) continue;
    return { link, href };
  }

  return null;
}

async function loginAs(page, role) {
  const creds = CREDENTIALS[role];
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: TIMEOUT });

  const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first();

  await emailInput.waitFor({ state: 'visible', timeout: TIMEOUT });
  await passwordInput.waitFor({ state: 'visible', timeout: TIMEOUT });

  await emailInput.fill(creds.email);
  await passwordInput.fill(creds.password);
  await page.getByRole('button', { name: /đăng nhập|login/i }).first().click();
  await page.waitForURL('**/', { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle');
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    // Flow 1 + 2 + 3 (public flows)
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
      const homeHasCoreUI = await page.getByText(/COOLMATE/i).first().isVisible({ timeout: TIMEOUT }).catch(() => false);
      assert(homeHasCoreUI, 'Home does not render header/logo.');
      pass('Home');

      const visibleProduct = await getFirstVisibleProductLink(page);
      assert(visibleProduct, 'Cannot find any visible product link on Home.');
      const { link: firstProductLink, href: productHref } = visibleProduct;

      await firstProductLink.click();
      await page.waitForURL('**/product/**', { timeout: TIMEOUT });
      await page.waitForLoadState('networkidle');

      const productTitleVisible = await page.locator('h1').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
      assert(productTitleVisible, 'Product detail does not render title.');

      const addToCartButton = page.getByRole('button', { name: /thêm vào giỏ|add to cart/i });
      const addToCartVisible = await addToCartButton.isVisible({ timeout: 4000 }).catch(() => false);
      pass('Product Detail', productHref);

      if (addToCartVisible) {
        await addToCartButton.click();
      } else {
        info('Cart setup', 'Add-to-cart button is not visible, skip add-to-cart step.');
      }

      await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle', timeout: TIMEOUT });
      const cartVisible = await page.getByText(/giỏ hàng|thanh toán|tạm tính|cart|checkout/i).first().isVisible({ timeout: TIMEOUT }).catch(() => false);
      assert(cartVisible, 'Cart page does not render correctly.');
      pass('Cart');

      await context.close();
    }

    // Flow 4 (admin categories)
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, 'admin');
      await page.goto(`${BASE_URL}/admin/categories`, { waitUntil: 'networkidle', timeout: TIMEOUT });
      const categoriesVisible = await page.getByText(/cây danh mục|chi tiết danh mục|danh mục|categories/i).first().isVisible({ timeout: TIMEOUT }).catch(() => false);
      assert(categoriesVisible, `Admin Categories content not visible. Current URL: ${page.url()}`);
      pass('Admin Categories');

      await context.close();
    }

    // Flow 5 (vendor products)
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, 'vendor');
      await page.goto(`${BASE_URL}/vendor/products`, { waitUntil: 'networkidle', timeout: TIMEOUT });
      const productsVisible = await page.getByText(/sản phẩm|danh sách sản phẩm|thêm sản phẩm|products/i).first().isVisible({ timeout: TIMEOUT }).catch(() => false);
      assert(productsVisible, 'Vendor Products content not visible.');
      pass('Vendor Products');

      await context.close();
    }

    console.log('SMOKE RESULT: ALL PASS');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  fail('Smoke Regression', error);
  process.exitCode = 1;
});
