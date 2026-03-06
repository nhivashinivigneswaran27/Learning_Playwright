import { test, expect } from '@playwright/test';
const testData = {
  name: 'Nhivashini',
  email: 'nhivashini@mail.com',
  phone: '9876543210',
  address: '123, Anna Nagar, Chennai',
  country: 'india',
  color: 'yellow',
  sortedList: 'cat',
  day: 'Sunday'
};
test('Form Submission Test', async ({ page }) => {
  await page.goto('https://testautomationpractice.blogspot.com/');
  await page.locator('#PageList2').getByRole('link', { name: 'Home' }).click();
  
  await page.getByRole('textbox', { name: 'Enter Name' }).fill(testData.name);
  await page.getByRole('textbox', { name: 'Enter EMail' }).fill(testData.email);
  await page.getByRole('textbox', { name: 'Enter Phone' }).fill(testData.phone);
  await page.getByRole('textbox', { name: 'Address:' }).fill(testData.address);
  
  await page.locator('.form-group > div:nth-child(4)').first().click();
  await page.getByRole('checkbox', { name: testData.day }).check();
  
  await page.getByLabel('Country:').selectOption(testData.country);
  await page.getByLabel('Colors:').selectOption(testData.color);
  await page.getByLabel('Sorted List:').selectOption(testData.sortedList);
});