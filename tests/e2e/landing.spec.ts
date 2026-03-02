import { expect, test } from "@playwright/test";

test("landing shows agenda and upcoming events section", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Real connections, clear agenda\./i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Upcoming Events/i })).toBeVisible();
});
