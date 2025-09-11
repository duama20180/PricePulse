from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import logging

# Налаштування логування
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Явно визначаємо походження та методи для CORS
CORS(app, resources={r"/api/*": {"origins": "http://127.0.0.1:5500", "methods": ["GET", "POST", "DELETE"],
                                 "allow_headers": ["Content-Type"]}}, supports_credentials=True)

DB_CONFIG = {
    'dbname': os.environ.get('DB_NAME', 'price_pulse_db'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'your_password'),
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5433')
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dim_product (
            product_id VARCHAR(255) PRIMARY KEY,
            bouquet_name VARCHAR(255),
            photo_url VARCHAR(255),
            added_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    """)
    cur.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name='fact_price_history' AND column_name='scrape_date') THEN
                ALTER TABLE fact_price_history ADD COLUMN scrape_date TIMESTAMP;
            END IF;
        END $$;
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fact_price_history (
            snapshot_id SERIAL PRIMARY KEY,
            product_id VARCHAR(255) REFERENCES dim_product(product_id),
            price_uah DECIMAL(10, 2),
            scrape_date TIMESTAMP
        )
    """)
    conn.commit()
    cur.close()
    conn.close()

@app.route('/api/products', methods=['GET'])
def get_products():
    init_db()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 9))
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Get paginated products with explicit ordering
        cur.execute("""
            SELECT product_id, bouquet_name, photo_url, added_at, updated_at
            FROM dim_product
            ORDER BY added_at DESC, product_id ASC
            LIMIT %s OFFSET %s
        """, (per_page, offset))
        products = cur.fetchall()
        logger.debug(f'Fetched products for page {page}: {products}')

        # Get total product count
        cur.execute("SELECT COUNT(*) AS total FROM dim_product")
        total = cur.fetchone()['total']
        logger.debug(f'Total count: {total}')

        return jsonify({'products': products, 'total_count': total})

    except Exception as e:
        logger.error(f'Error fetching products: {e}')
        return jsonify({'error': 'Failed to fetch products'}), 500

    finally:
        cur.close()
        conn.close()

@app.route('/api/price_history/<product_id>', methods=['GET'])
def get_price_history(product_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT price_uah, scrape_date
        FROM fact_price_history
        WHERE product_id = %s
        ORDER BY scrape_date DESC
    """, (product_id,))
    history = cur.fetchall()
    cur.close()
    conn.close()
    response = jsonify(history)
    response.headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:5500')
    return response

@app.route('/api/delete_product/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM fact_price_history WHERE product_id = %s", (product_id,))
    cur.execute("DELETE FROM dim_product WHERE product_id = %s", (product_id,))
    conn.commit()
    cur.close()
    conn.close()
    response = jsonify({'message': f'Product {product_id} deleted'})
    response.headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:5500')
    return response

@app.route('/api/add_product', methods=['POST'])
def add_product():
    data = request.get_json()
    product_id = data.get('product_id')
    bouquet_name = data.get('bouquet_name', 'Новий товар')
    photo_url = data.get('photo_url')
    added_at = datetime.utcnow()
    updated_at = added_at

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO dim_product (product_id, bouquet_name, photo_url, added_at, updated_at)
        VALUES (%s, %s, %s, %s, %s)
    """, (product_id, bouquet_name, photo_url, added_at, updated_at))
    conn.commit()
    cur.close()
    conn.close()
    response = jsonify({'message': f'Product {product_id} added'})
    response.headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:5500')
    return response

@app.route("/debug")
def debug():
    from psycopg2.extras import RealDictCursor
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM dim_product ORDER BY updated_at DESC LIMIT 1;")
    row = cur.fetchone()
    print(f"Latest product: {row}")
    return jsonify(row)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)