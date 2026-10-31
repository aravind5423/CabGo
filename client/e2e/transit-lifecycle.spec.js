import { test, expect } from '@playwright/test';

test.describe('Rydio Urban Transit End-to-End Modern SPA Lifecycle', () => {

  test('1. Authentication Portal - 1-Click Demo Login and Role Redirection', async ({ page }) => {
    await page.goto('/login');

    // Verify title and brand header
    await expect(page.locator('h1')).toContainText('Rydio');

    // Test 1-click Passenger Demo Button
    const passengerDemoBtn = page.getByRole('button', { name: /Passenger/i }).first();
    await expect(passengerDemoBtn).toBeVisible();
    await passengerDemoBtn.click();

    // Verify redirection to Passenger Dashboard
    await page.waitForURL('**/passenger/dashboard', { timeout: 10000 });
    await expect(page.getByText('Passenger', { exact: false })).toBeVisible();
    await expect(page.getByText('Book a New Ride', { exact: false })).toBeVisible();
  });

  test('2. Passenger Booking Flow with Interactive Leaflet Map Preview', async ({ page }) => {
    // Login as seeded passenger1
    await page.goto('/login');
    await page.fill('input[name="email"]', 'passenger1@cab.com');
    await page.fill('input[name="password"]', 'Pass@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/passenger/dashboard');

    // Navigate to Book Ride
    await page.click('a[href="/passenger/book-ride"]');
    await page.waitForURL('**/passenger/book-ride');

    // Fill pickup and destination
    await page.fill('input[name="pickup_location"]', 'Chennai Central Railway Station');
    await page.fill('input[name="destination"]', 'Chennai Airport');

    // Verify interactive Leaflet Map preview renders
    const mapPreview = page.locator('.leaflet-container');
    await expect(mapPreview).toBeVisible();

    // Click Get Fare Quote
    const quoteBtn = page.getByRole('button', { name: /Get Fare Quote/i });
    await quoteBtn.click();

    // Verify fare quote display
    await expect(page.getByText('Estimated Road Fare')).toBeVisible();

    // Request Ride Now
    const requestBtn = page.getByRole('button', { name: /Request Ride Now/i });
    await requestBtn.click();

    // Verify transition to Active Trip HUD
    await page.waitForURL('**/passenger/active-trip');
    await expect(page.getByText('Active Trip HUD')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('3. Driver Console - Availability, Live Radar, and Ride Fulfillment Flow', async ({ page }) => {
    // Login as driver1
    await page.goto('/login');
    await page.fill('input[name="email"]', 'driver1@cab.com');
    await page.fill('input[name="password"]', 'Driver@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/driver/dashboard');

    await expect(page.getByText('Driver Partner')).toBeVisible();

    // Check if offline, toggle online
    const onlineBtn = page.getByRole('button', { name: /Go Online/i });
    if (await onlineBtn.isVisible()) {
      await onlineBtn.click();
      await expect(page.getByText('You are Online')).toBeVisible({ timeout: 5000 });
    }

    // Radar should be live
    await expect(page.getByText('Live Vehicle Radar & GPS HUD')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('4. Operations Admin & SuperAdmin Portals Verification', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@cab.com');
    await page.fill('input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await expect(page.getByText('Operations Admin')).toBeVisible();
    await expect(page.getByText('Total Booked Trips')).toBeVisible();

    // Login as superadmin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'superadmin@cab.com');
    await page.fill('input[name="password"]', 'SuperAdmin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/superadmin/dashboard');

    await expect(page.getByText('Super Administrator')).toBeVisible();
    await expect(page.getByText('Global Transit Overview')).toBeVisible();
  });

});
