from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from scripts.bronze import scrape_flowers
from scripts.silver import transform_to_silver
from scripts.gold import create_views

default_args = {
    "owner": "airflow",
    "start_date": datetime(2025, 6, 25),
    "retries": 1,
}

with DAG(
    dag_id="medallion_etl_pipeline",
    default_args=default_args,
    schedule_interval="@daily",
    catchup=False,
    tags=["etl", "medallion"]
) as dag:

    bronze = PythonOperator(
        task_id="bronze_layer",
        python_callable=scrape_flowers,
    )

    silver = PythonOperator(
        task_id="silver_layer",
        python_callable=transform_to_silver,
    )

    gold = PythonOperator(
        task_id="gold_layer",
        python_callable=create_views(),
    )

    bronze >> silver >> gold