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
      const amount = document.querySelector(
        '[data-cy-id="price_unit__value"]',
      )?.innerText;
      const currency = document.querySelector(
        '[data-cy-id="price_unit__currency"]',
      )?.innerText;
      return amount && currency ? `${amount} ${currency}` : null;
    });

    if (result) {
      const history = getStoredData();
      const newEntry = {
        id: Date.now(),
        date: new Date().toLocaleString("it-IT"),
        price: result,
      };
      const updatedHistory = [newEntry, ...history].slice(0, 100);
      fs.writeFileSync(DATA_PATH, JSON.stringify(updatedHistory, null, 2));
      console.log(`Success: Current price ${result}`);

      // Check for price drop and send alerts
      if (history.length > 0) {
        const newPrice = parsePrice(result);
        const prevPrice = parsePrice(history[0].price);
        if (newPrice !== null && prevPrice !== null && newPrice < prevPrice) {
          if (CHAT_ID) {
            const alertMessage = `Alert: Price dropped! Current: ${result}, Previous: ${history[0].price}`;
            bot.telegram
              .sendMessage(CHAT_ID, alertMessage)
              .catch((err) => console.error("Error sending alert:", err));
          } else {
            console.warn(
              "Warning: CHAT_ID is not defined in environment variables. No alert sent.",
            );
          }
        }
      }
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
    ctx.reply(`Current price: ${history[0].price}`);
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
