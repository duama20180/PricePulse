export function createChart(canvasId, history, isModal = false) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) {
    console.error(`Canvas with id ${canvasId} not found!`);
    return null;
  }

  // Сортуємо історію за датою
  history.sort((a, b) => new Date(a.scrape_date) - new Date(b.scrape_date));

  const dates = history.map(item => new Date(item.scrape_date).toISOString().split('T')[0]);
  const prices = history.map(item => item.price_uah);

  console.log(`Creating chart for ${canvasId}: dates=${dates}, prices=${prices}, isModal=${isModal}`);

  // Колір лінії та фону в залежності від зміни ціни
  let lineColor = 'blue';
  let fillColor = 'transparent';

  if (prices.length > 1) {
    const lastChange = prices[prices.length - 1] - prices[prices.length - 2];
    lineColor = lastChange > 0 ? 'red' : lastChange < 0 ? 'green' : 'blue';

    if (isModal) {
      fillColor = lastChange > 0 ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';
    }
  }

  const datasets = [{
    label: 'Ціна',
    data: prices,
    borderColor: lineColor,
    backgroundColor: fillColor,
    borderWidth: isModal ? 3 : 2,
    fill: isModal ? 'origin' : false,
    pointRadius: prices.length === 1 ? 5 : (isModal ? 4 : 3),
    pointHoverRadius: prices.length === 1 ? 7 : (isModal ? 6 : 4),
    pointStyle: prices.length === 1 ? 'circle' : undefined,
    tension: 0.1
  }];

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          display: isModal,
          title: {
            display: isModal,
            text: 'Дата',
            font: { size: isModal ? 14 : 10 }
          },
          ticks: {
            display: isModal,
            font: { size: isModal ? 12 : 8 }
          },
          grid: { display: isModal }
        },
        y: {
          display: isModal,
          title: {
            display: isModal,
            text: 'Ціна (грн)',
            font: { size: isModal ? 14 : 10 }
          },
          ticks: {
            display: isModal,
            font: { size: isModal ? 12 : 8 }
          },
          grid: { display: isModal }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true, // Увімкнено для всіх випадків
          callbacks: {
            label: function(context) {
              return isModal ? `Ціна: ${context.parsed.y} грн` : `Ціна: ${context.parsed.y} грн`; // Один і той самий формат
            }
          }
        }
      },
      elements: {
        line: {
          borderWidth: isModal ? 3 : 2
        },
        point: {
          radius: prices.length === 1 ? 5 : (isModal ? 4 : 3),
          hoverRadius: prices.length === 1 ? 7 : (isModal ? 6 : 4)
        }
      }
    }
  });

  return chart;
}