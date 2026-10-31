import { test, expect } from '@playwright/test';

// Browser E2E against the production build served by Express (http://localhost:5000).
// Run: npm run build:client && npm run test:browser

async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

test.describe('Rydio end-to-end', () => {

  test('1. Demo login buttons redirect by role', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Rydio' }).or(page.getByText('Rydio').first())).toBeVisible();

    await page.getByRole('button', { name: 'Passenger', exact: true }).click();
    await page.waitForURL('**/passenger/dashboard', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText('Total bookings')).toBeVisible();
  });

  test('2. Passenger can quote a fare and open the route preview', async ({ page }) => {
    await login(page, 'passenger1@cab.com', 'Pass@123');
    await page.waitForURL('**/passenger/dashboard');

    await page.click('a[href="/passenger/book-ride"]');
    await page.waitForURL('**/passenger/book-ride');

    await page.fill('input[name="pickup_location"]', 'Chennai Central Railway Station');
    await page.fill('input[name="destination"]', 'Chennai Airport');
    await expect(page.locator('.leaflet-container')).toBeVisible();

    await page.getByRole('button', { name: /Get fare quote/i }).click();
    await expect(page.getByText(/estimated road distance/i)).toBeVisible({ timeout: 15000 });
  });

  test('3. Driver dashboard shows availability control and vehicle', async ({ page }) => {
    await login(page, 'driver1@cab.com', 'Driver@123');
    await page.waitForURL('**/driver/dashboard');

    await expect(page.getByRole('heading', { name: 'Driver dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Go (online|offline)/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Active vehicle', { exact: true })).toBeVisible();
    await expect(page.getByText('TN-09-AB-1234')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Today's earnings")).toBeVisible();
  });

  test('4. Admin and superadmin portals load their data', async ({ page }) => {
    await login(page, 'admin@cab.com', 'Admin@123');
    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(page.getByText('Total trips')).toBeVisible();
    await page.getByRole('tab', { name: /Fare rules/ }).click();
    await expect(page.getByText('Fare rules by vehicle type')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sedan' })).toBeVisible({ timeout: 10000 });

    await login(page, 'superadmin@cab.com', 'SuperAdmin@123');
    await page.waitForURL('**/superadmin/dashboard');
    await expect(page.getByRole('heading', { name: 'Control panel' })).toBeVisible();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByLabel('Platform commission (%)')).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: 'Audit log' }).click();
    await expect(page.getByText(/events recorded/)).toBeVisible({ timeout: 10000 });
  });

  test('5. Wrong-role route redirects to own dashboard', async ({ page }) => {
    await login(page, 'passenger1@cab.com', 'Pass@123');
    await page.waitForURL('**/passenger/dashboard');
    await page.goto('/admin/dashboard');
    await page.waitForURL('**/passenger/dashboard');
  });
});
