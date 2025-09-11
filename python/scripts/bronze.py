import datetime
import json
import os
import time
from pathlib import Path

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


def scrape_flowers():
    # Set up Selenium WebDriver
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")  # Run in headless mode (no browser UI)
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    url = "https://flowers.ua/ua-kiev/rozy"
    driver.get(url)
    flowers_data = []
    seen_ids = set()  # Track unique product IDs to avoid duplicates

    try:
        while True:
            # Get current number of items
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            items = soup.find_all('div', class_='item')
            current_item_count = len(items)

            # Scroll to the bottom of the page
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)  # Wait for new items to load

            # Check if loader is visible
            try:
                loader = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "loader"))
                )
                if loader.get_attribute("style") == "display: none;":
                    print("Loader is hidden. No more items to load.")
                    break
            except:
                print("Loader not found or timed out. Checking for new items.")

            # Check if new items were loaded
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            items = soup.find_all('div', class_='item')
            if len(items) == current_item_count:
                print("No new items loaded. Stopping scroll.")
                break

        # Extract data from all items
        for item in items:
            # Extract product ID to avoid duplicates
            product_id = item.get('data-eec-id', 'N/A')
            if product_id in seen_ids:
                print(f"Duplicate product ID {product_id}. Skipping.")
                continue
            seen_ids.add(product_id)

            # Extract bouquet name
            title_div = item.find('div', class_='title')
            bouquet_name = title_div.text.strip() if title_div else "N/A"

            # Extract price
            price_div = item.find('div', class_='price')
            price = "N/A"
            if price_div:
                new_price = price_div.get('data-new-price')
                old_price_span = price_div.find('span', class_='old')
                if new_price:
                    price = new_price.strip()
                elif old_price_span:
                    price = old_price_span.text.strip()

            # Extract photo URL
            img_tag = item.find('img')
            photo_url = img_tag['src'] if img_tag and 'src' in img_tag.attrs else "N/A"

            # Store data
            flowers_data.append({
                "bouquet_name": bouquet_name,
                "price": price,
                "photo_url": photo_url,
                "product_id": product_id
            })

        print(f"Scraped {len(flowers_data)} unique bouquets.")

    finally:
        driver.quit()  # Close the browser


    # Save data to a JSON file
    data_dir = Path(__file__).resolve().parent.parent / 'python' / 'scripts'/ 'data' / 'bronze'
    os.makedirs(data_dir, exist_ok=True)

    current_date = datetime.date.today().strftime('%Y%m%d')
    file_path = data_dir / f'flowers_data_{current_date}.json'
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(flowers_data, f, ensure_ascii=False, indent=4)

    print("Data saved to flowers_data.json")
    return flowers_data

if __name__ == "__main__":
    scrape_flowers()
    print()