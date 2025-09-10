
const symbolToId = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOT: "polkadot",
  LTC: "litecoin",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
};

const symbolToImage = {
  BTC: "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/thumb/solana.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/thumb/dogecoin.png",
  XRP: "https://assets.coingecko.com/coins/images/44/thumb/xrp.png",
  ADA: "https://assets.coingecko.com/coins/images/975/thumb/cardano.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/thumb/polkadot.png",
  LTC: "https://assets.coingecko.com/coins/images/2/thumb/litecoin.png",
  BNB: "https://assets.coingecko.com/coins/images/825/thumb/binance-coin-logo.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/thumb/coin-round-red.png",
};

// Colors for pie chart and line chart
const chartColors = [
  "#ff6384","#36a2eb","#ffce56","#4bc0c0",
  "#9966ff","#ff9f40","#8dd17e","#e57373",
  "#81d4fa","#a4c639"
];

document.addEventListener("DOMContentLoaded", () => {
  // HTML elements
  const symbolInput = document.getElementById("symbolInput");
  const amountInput = document.getElementById("amountInput");
  const addAssetBtn = document.getElementById("addAssetBtn");
  const portfolioDiv = document.getElementById("portfolio");
  const totalValueEl = document.getElementById("totalValue");
  const chartCanvas = document.getElementById("portfolioChart");
  const currencySelect = document.getElementById("currencySelect");
  const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
  const historyContainer = document.getElementById("historyContainer");
  const historyCanvas = document.getElementById("historyChart");

  // Variables
  let portfolio = JSON.parse(localStorage.getItem("portfolio")) || [];
  let portfolioHistory = JSON.parse(localStorage.getItem("portfolioHistory")) || {};
  let chart, historyChart;
  let selectedCurrency = currencySelect.value;
  let currentRange = 10; // default last 10 days

  // Fetching coin data from Coingecko
  async function fetchCoinData(symbol) {
    const id = symbolToId[symbol.toUpperCase()];
    if (!id) return null;
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${selectedCurrency}`
      );
      const data = await res.json();
      if (!data[id] || data[id][selectedCurrency] === undefined) return null;
      return { price: data[id][selectedCurrency], image: symbolToImage[symbol.toUpperCase()] || "" };
    } catch (err) {
      console.error("Error fetching coin data:", err);
      return null;
    }
  }

  // Record live prices for history
  function recordPortfolioHistory() {
    const now = new Date().toISOString();
    portfolio.forEach(asset => {
      if (!portfolioHistory[asset.symbol]) portfolioHistory[asset.symbol] = [];
      portfolioHistory[asset.symbol].push({ time: now, price: asset.price });
      // Keep max 500 points per coin
      if (portfolioHistory[asset.symbol].length > 500) portfolioHistory[asset.symbol].shift();
    });
    localStorage.setItem("portfolioHistory", JSON.stringify(portfolioHistory));
  }

  // Refresh portfolio
  async function refreshPortfolio() {
    for (let asset of portfolio) {
      const data = await fetchCoinData(asset.symbol);
      if (data) {
        asset.price = data.price;
        asset.image = data.image;
        if (!asset.buyPrice) asset.buyPrice = data.price;
      }
    }
    renderPortfolio();
    recordPortfolioHistory();
    localStorage.setItem("portfolio", JSON.stringify(portfolio));
    if (historyContainer.style.display === "block") updateHistoryChart();
  }

  // Render portfolio
  function renderPortfolio() {
    portfolioDiv.innerHTML = "";
    let total = 0;
    portfolio.forEach(asset => total += asset.amount * asset.price);

    portfolio.forEach((asset, index) => {
      const value = asset.amount * asset.price;
      const percent = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
      const pnl = ((asset.price - asset.buyPrice) * asset.amount).toFixed(2);
      const pnlColor = pnl >= 0 ? "green" : "red";

      const div = document.createElement("div");
      div.className = "asset";
      div.innerHTML = `
        <strong><img src="${asset.image}" width="20" height="20"> ${asset.symbol}</strong>
        - <input type="number" class="editAmount" data-index="${index}" value="${asset.amount}" step="0.0001">
        × ${selectedCurrency.toUpperCase()} ${asset.price.toLocaleString()} 
        = <b>${selectedCurrency.toUpperCase()} ${value.toLocaleString()}</b> 
        <span style="color: gray;">(${percent}%)</span>
        <span style="color: ${pnlColor};">(PnL: ${pnl})</span>
        <button class="removeBtn" data-index="${index}">❌</button>
      `;
      portfolioDiv.appendChild(div);
    });

    totalValueEl.textContent = `Total Portfolio Value: ${selectedCurrency.toUpperCase()} ${total.toLocaleString()}`;

    // Remove asset button
    document.querySelectorAll(".removeBtn").forEach(btn => {
      btn.addEventListener("click", e => {
        portfolio.splice(e.target.dataset.index, 1);
        renderPortfolio();
        localStorage.setItem("portfolio", JSON.stringify(portfolio));
      });
    });

    // Edit amount input
    document.querySelectorAll(".editAmount").forEach(input => {
      input.addEventListener("change", e => {
        const idx = e.target.dataset.index;
        const newAmt = parseFloat(e.target.value);
        if (!isNaN(newAmt) && newAmt >= 0) {
          portfolio[idx].amount = newAmt;
          renderPortfolio();
          localStorage.setItem("portfolio", JSON.stringify(portfolio));
        }
      });
    });

    updateChart();
  }

  // Pie chart
  function updateChart() {
    if (!chart) {
      chart = new Chart(chartCanvas, {
        type: "pie",
        data: { labels: [], datasets: [{ data: [], backgroundColor: chartColors }] },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });
    }
    chart.data.labels = portfolio.map(a => a.symbol);
    chart.data.datasets[0].data = portfolio.map(a => (a.amount * a.price).toFixed(2));
    chart.update();
  }

  // History chart (line chart) with sampled points
  function updateHistoryChart() {
    if (!historyChart) {
      historyChart = new Chart(historyCanvas, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          interaction: { mode: "index", intersect: false },
          scales: { 
            x: { title: { display: true, text: "Date" } }, 
            y: { title: { display: true, text: `Price (${selectedCurrency.toUpperCase()})` } } 
          }
        }
      });
    }

    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - currentRange);

    const labels = [];
    const datasets = [];

    portfolio.forEach((asset, idx) => {
      const color = chartColors[idx % chartColors.length];
      const history = (portfolioHistory[asset.symbol] || []).filter(p => new Date(p.time) >= cutoff);
      if (history.length === 0) return;

      // Set interval in days based on range
      let interval;
      if (currentRange <= 10) interval = 2;
      else if (currentRange <= 30) interval = 2;
      else if (currentRange <= 90) interval = 15;
      else interval = 30;
      const points = [];
      const pointLabels = [];
      let lastDate = new Date(history[0].time);

      history.forEach(p => {
        const date = new Date(p.time);
        const diffDays = Math.floor((date - lastDate) / (1000*60*60*24));
        if (diffDays >= interval) {
          points.push(p.price);
          pointLabels.push(date.toLocaleDateString([], { month: "short", day: "numeric" }));
          lastDate = date;
        }
      });
      // Always include last point
      if (points[points.length-1] !== history[history.length-1].price) {
        points.push(history[history.length-1].price);
        pointLabels.push(new Date(history[history.length-1].time).toLocaleDateString([], { month: "short", day: "numeric" }));
      }
      if (labels.length === 0) labels.push(...pointLabels);

      datasets.push({
        label: asset.symbol,
        data: points,
        borderColor: color,
        backgroundColor: color + "33",
        tension: 0.3
      });
    });

    historyChart.data.labels = labels;
    historyChart.data.datasets = datasets;
    historyChart.update();
  }

  // Events
  addAssetBtn.addEventListener("click", async () => {
    const symbol = symbolInput.value.trim().toUpperCase();
    const amount = parseFloat(amountInput.value);
    if (!symbol || isNaN(amount) || amount <= 0) return alert("Invalid input");
    if (!symbolToId[symbol]) return alert(`Symbol "${symbol}" not supported`);

    const data = await fetchCoinData(symbol);
    if (!data) return alert(`Could not fetch data for "${symbol}"`);

    const existing = portfolio.findIndex(a => a.symbol === symbol);
    if (existing !== -1) {
      portfolio[existing].amount += amount;
      portfolio[existing].price = data.price;
    } else {
      portfolio.push({ symbol, amount, price: data.price, buyPrice: data.price, image: data.image });
    }
    renderPortfolio();
    localStorage.setItem("portfolio", JSON.stringify(portfolio));
    symbolInput.value = "";
    amountInput.value = "";
  });

  currencySelect.addEventListener("change", () => {
    selectedCurrency = currencySelect.value;
    refreshPortfolio();
  });

  toggleHistoryBtn.addEventListener("click", () => {
    historyContainer.style.display =
      historyContainer.style.display === "none" ? "block" : "none";
    toggleHistoryBtn.textContent =
      historyContainer.style.display === "block"
        ? "Hide Historical Performance"
        : "Show Historical Performance";
    if (historyContainer.style.display === "block") updateHistoryChart();
  });

  renderPortfolio();
  refreshPortfolio();
  setInterval(refreshPortfolio, 15000); // auto-refresh every 15s
});
