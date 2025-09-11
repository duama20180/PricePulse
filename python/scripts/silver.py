import json
import os
import psycopg2
import re
from psycopg2.extras import execute_values
from pathlib import Path
from datetime import date
from dotenv import load_dotenv

def transform_to_silver():

    load_dotenv()

    # Connecting to PostgresDB
    conn = psycopg2.connect(
        host=os.getenv("PG_HOST"),
        port=os.getenv("PG_PORT"),
        user=os.getenv("PG_USER"),
        password=os.getenv("PG_PASSWORD"),
        dbname=os.getenv("PG_DB")
    )

    cursor = conn.cursor()

    # Path to json from bronze layer
    current_date = date.today().strftime("%Y%m%d")

    bronze_path = Path(__file__).resolve().parent.parent / 'data' / 'bronze' / f'flowers_data_{current_date}.json'

    with open(bronze_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for row in data:
        product_id = row["product_id"]
        name = row["bouquet_name"]
        price = float(re.sub(r'[^\d.,]', '', row["price"]))
        photo_url = row["photo_url"]
        scrape_date = date.today()

        # 1. Check if product is already present in dim_product
        cursor.execute("""
            SELECT bouquet_name, photo_url FROM dim_product WHERE product_id = %s
        """, (product_id,))
        result = cursor.fetchone()

        if result is None:
            # Insert new product
            cursor.execute("""
                INSERT INTO dim_product (product_id, bouquet_name, photo_url, added_at, updated_at)
                VALUES (%s, %s, %s, NOW(), NOW())
            """, (product_id, name, photo_url))
        else:
            old_name, old_url = result
            if old_name != name or old_url != photo_url:
                # Updating existing product
                cursor.execute("""
                    UPDATE dim_product
                    SET bouquet_name = %s, photo_url = %s, updated_at = NOW()
                    WHERE product_id = %s
                """, (name, photo_url, product_id))

        # 2. Check the most recent price in fact_price_history
        cursor.execute("""
            SELECT price_uah FROM fact_price_history
            WHERE product_id = %s
            ORDER BY scrape_date DESC
            LIMIT 1
        """, (product_id,))
        last_price = cursor.fetchone()

        if last_price is None or last_price[0] != price:
            # Add new snapshot if the price was renewed
            cursor.execute("""
                INSERT INTO fact_price_history (product_id, price_uah, scrape_date)
                VALUES (%s, %s, %s)
            """, (product_id, price, scrape_date))

    # Close transaction
    conn.commit()
    cursor.close()
    conn.close()
    print("Silver layer transformation complete.")

if __name__ == "__main__":
    transform_to_silver()
    print()