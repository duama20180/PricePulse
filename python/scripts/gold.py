import os
import psycopg2
from dotenv import load_dotenv



def create_views():
    conn = psycopg2.connect(
        host=os.getenv("PG_HOST"),
        port=os.getenv("PG_PORT"),
        user=os.getenv("PG_USER"),
        password=os.getenv("PG_PASSWORD"),
        dbname="price_pulse_db"
    )
    cursor = conn.cursor()
    cursor.execute("""
        DROP VIEW IF EXISTS description_view
        """)

    cursor.execute("""
        CREATE VIEW description_view AS (
        SELECT DISTINCT ON (fph.product_id)
        fph.product_id,dp.bouquet_name, dp.photo_url, fph.price_uah AS latest_price
        FROM fact_price_history AS fph
        JOIN dim_product AS dp USING (product_id)
        ORDER BY fph.product_id, fph.scrape_date DESC)

    """)

    cursor.execute("""
        DROP VIEW IF EXISTS history_for_graph_view
        """)

    cursor.execute("""
        CREATE VIEW history_for_graph_view AS (
        SELECT product_id, price_uah, scrape_date
        FROM fact_price_history AS fph)
    """)

    conn.commit()
    cursor.close()
    conn.close()

    print("Views created successfully.")



if __name__ == "__main__":
    load_dotenv()
    create_views()