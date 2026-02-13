import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import puppeteer from "puppeteer";
import fs from "fs";
import cron from "node-cron";

const DATA_PATH = process.env.DATA_PATH;
const TARGET_URL = process.env.TARGET_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!DATA_PATH) {
  console.error("Error: DATA_PATH is not defined in environment variables.");
  process.exit(1);
}
if (!TARGET_URL) {
  console.error("Error: TARGET_URL is not defined in environment variables.");
  process.exit(1);
}
if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is not defined in environment variables.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const getStoredData = () => {
  if (!fs.existsSync(DATA_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH));
  } catch (e) {
    return [];
  }
};

// Function to parse price string to number (e.g., "10.99 USD" -> 10.99)
const parsePrice = (priceStr) => {
  const match = priceStr.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

const performScrape = async () => {
    console.log(
    `[${new Date().toLocaleString()}] Starting automatic scraping...`,
  );
  let browser;
  try {
        browser = await puppeteer.launch({ 
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    );
    await page.goto(TARGET_URL, { waitUntil: "networkidle2" });
    await page.waitForSelector('[data-cy-id="price_unit__value"]', {
      timeout: 15000,
    });

    const result = await page.evaluate(() => {
      const priceElements = document.querySelectorAll(
        '[data-cy-id="price_unit__value"]',
      );
      const currencyElements = document.querySelectorAll(
        '[data-cy-id="price_unit__currency"]',
      );

      if (priceElements.length === 0) return null;

      const prices = Array.from(priceElements).map((el, index) => {
        const priceText = el.innerText.trim();
        const currency = currencyElements[index]?.innerText.trim() || "";
        const numericPrice = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        return {
          amount: priceText,
          currency: currency,
          numeric: numericPrice,
        };
      });

      const validPrices = prices.filter((p) => !isNaN(p.numeric));
      if (validPrices.length === 0) return null;

      const minPrice = validPrices.reduce((min, current) =>
        current.numeric < min.numeric ? current : min,
      );

      return `${minPrice.amount} ${minPrice.currency}`;
    });

    if (result) {
      const history = getStoredData();
      const newEntry = {
        id: Date.now(),
        date: new Date().toLocaleString("it-IT"),
        price: result,
      };
      fs.writeFileSync(
        DATA_PATH,
        JSON.stringify([newEntry, ...history].slice(0, 100), null, 2),
      );
      console.log(`Success: Current price ${result}`);
    }
  } catch (error) {
    console.error("Error during scheduled scraping:", error.message);
  } finally {
    if (browser) await browser.close();
  }
};

// Telegram bot commands
bot.start((ctx) => {
  ctx.reply(
    "Welcome to the Price Tracker Bot!\n\nTutorial:\n- Use /price to get the current price.\n- I'll automatically alert the chat_id used in the configuration file if the price drops below the previous one.",
  );
});

performScrape();

bot.command("price", (ctx) => {
  const history = getStoredData();
  if (history.length > 0) {
    ctx.reply(`Current price: ${history[0].price} (last checked: ${history[0].date})`);
  } else {
    ctx.reply("No price data available yet.");
  }
});

// Schedule: '0 15 * * *' means Minute 0, Hour 15, Every day
cron.schedule(
  "0 15 * * *",
  () => {
    performScrape();
  },
  {
    scheduled: true,
    timezone: "Europe/Rome",
  },
);

bot.launch();
