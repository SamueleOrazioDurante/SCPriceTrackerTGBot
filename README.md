# Star Citizen Price Tracker Telegram Bot

A simple Telegram bot created in one evening to track the lowest price of the Star Citizen package from the Roberts Space Industries (RSI) website. It automatically scrapes price data every 15 minutes, stores it in a JSON file, and sends alerts if the price drops below the previous value.

## Features

- **Automated Price Scraping**: Uses Puppeteer to scrape the lowest package price from the RSI website every 15 minutes (scheduled at 15:00 UTC+1, i.e., Europe/Rome timezone).
- **Data Storage**: Stores up to 100 price entries in `prices.json` for historical tracking.
- **Price Drop Alerts**: Automatically sends a Telegram message to the configured chat ID if the current price is lower than the previous one.
- **Telegram Commands**:
  - `/start`: Displays a welcome message with a tutorial.
  - `/price`: Returns the latest scraped price.
- **Error Handling**: Includes basic error handling for scraping failures and missing environment variables.

## Prerequisites

- Node.js (version 14 or higher) or Docker
- A Telegram bot token (obtain from [@BotFather](https://t.me/botfather))
- Environment variables set up in a `.env` file

## Setup

### With Docker (using pre-built image)

1. Clone or download this repository.
2. Ensure you have a `.env` file in the root directory with the required variables (see above).
3. Run the container:
   ```
   docker-compose up -d
   ```
   This will pull the pre-built image from GitHub Container Registry and start the bot.

### With Docker (build locally)

1. Clone or download this repository.
2. Ensure you have a `.env` file in the root directory with the required variables (see above).
3. Build and run the container:
   ```
   docker-compose -f docker-compose-dev.yml up --build
   ```
   This will build the Docker image locally and start the bot in a container, mounting the data volume for persistence.

### Without Docker

1. Clone or download this repository.
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:

   ```
   DATA_PATH=./prices.json
   TARGET_URL=https://robertsspaceindustries.com/pledge/packages  # Replace with the actual RSI package page URL if needed
   BOT_TOKEN=your_telegram_bot_token_here
   CHAT_ID=your_telegram_chat_id_here  # The chat ID where alerts will be sent
   ```

   - `DATA_PATH`: Path to the JSON file for storing price history (default: `./prices.json`).
   - `TARGET_URL`: The RSI webpage URL to scrape (ensure it points to the package price section).
   - `BOT_TOKEN`: Your Telegram bot token.
   - `CHAT_ID`: The Telegram chat ID for receiving alerts (can be a user or group chat).

4. Run the bot:
   ```
   node index.js
   ```

## Usage

- The bot will start automatically and begin scraping prices every 15 minutes.
- Interact with the bot via Telegram:
  - Send `/start` for instructions.
  - Send `/price` to get the current price.
- Price history is stored in `prices.json`. Each entry includes an ID, date, and price string (e.g., "10.99 USD").
