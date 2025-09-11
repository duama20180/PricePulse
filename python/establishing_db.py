import os
import psycopg2
from dotenv import load_dotenv


def create_database():
    conn = psycopg2.connect(
        host=os.getenv("PG_HOST"),
        port=os.getenv("PG_PORT"),
        user=os.getenv("PG_USER"),
        password=os.getenv("PG_PASSWORD"),
        dbname="postgres"
    )
    conn.autocommit = True
    cursor = conn.cursor()


    try:
        cursor.execute("CREATE DATABASE price_pulse_db;")
        print("Database created successfully.")
    except psycopg2.errors.DuplicateDatabase:
        print("Database already exists.")

    cursor.close()
    conn.close()

def create_tables():
    conn = psycopg2.connect(
        host=os.getenv("PG_HOST"),
        port=os.getenv("PG_PORT"),
        user=os.getenv("PG_USER"),
        password=os.getenv("PG_PASSWORD"),
        dbname="price_pulse_db"
    )
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dim_product (
        product_id VARCHAR PRIMARY KEY,
        bouquet_name TEXT,
        photo_url TEXT,
        added_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fact_price_history (
        snapshot_id SERIAL PRIMARY KEY,
        product_id VARCHAR REFERENCES dim_product(product_id),
        price_uah DECIMAL,
        scrape_date DATE
    );
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_fact_price_product_id ON fact_price_history(product_id);
        """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_fact_price_scrape_date ON fact_price_history(scrape_date);
        """)

    conn.commit()
    cursor.close()
    conn.close()

    print("Tables created successfully.")


load_dotenv()
create_database()
create_tables()