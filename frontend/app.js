// --- Constants and Global Variables ---
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let liveChart = null;
const maxChartPoints = 35;

// Elements cache
const simTimeEl = document.getElementById("sim-time");
const simDateEl = document.getElementById("sim-date");
const timeLabelEl = document.getElementById("time-label");
const valPowerEl = document.getElementById("val-power");
const valWaterEl = document.getElementById("val-water");
const valVoltageEl = document.getElementById("val-voltage");
const valTempEl = document.getElementById("val-temp");
const valHumidityEl = document.getElementById("val-humidity");

const statusPowerEl = document.getElementById("status-power");
const statusWaterEl = document.getElementById("status-water");
const statusVoltageEl = document.getElementById("status-voltage");

const cardElectricityEl = document.getElementById("card-electricity");
const cardWaterEl = document.getElementById("card-water");
const cardVoltageEl = document.getElementById("card-voltage");

const alertBannerEl = document.getElementById("alert-banner");
const healthBarEl = document.getElementById("health-bar");
const healthTextEl = document.getElementById("health-text");
const alertBoxEl = document.getElementById("active-alert-box");
const alertIconEl = document.getElementById("alert-box-icon");
const alertTitleEl = document.getElementById("alert-title");
const alertDescEl = document.getElementById("alert-desc");

const logTbodyEl = document.getElementById("log-tbody");
const logCountEl = document.getElementById("log-count");

// --- Helper Functions ---

// Format ISO timestamp to short local time (e.g. "12:04:22 PM")
function formatLocalTime(isoString, includeSeconds = true) {
    const d = new Date(isoString);
    if (includeSeconds) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Format ISO timestamp to calendar date (e.g. "July 16, 2026")
function formatLocalDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

// --- Initialize Chart.js ---
function initChart() {
    const ctx = document.getElementById('liveChart').getContext('2d');
    
    liveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Power (kW)',
                    data: [],
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.05)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 1.5,
                    yAxisID: 'y',
                },
                {
                    label: 'Water Flow (L/min)',
                    data: [],
                    borderColor: '#2dd4bf',
                    backgroundColor: 'rgba(45, 212, 191, 0.05)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 1.5,
                    yAxisID: 'y',
                },
                {
                    label: 'Voltage (V)',
                    data: [],
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.02)',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    tension: 0.2,
                    pointRadius: 0,
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false,
            plugins: {
                legend: {
                    display: false // Using custom HTML legends
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(96, 165, 250, 0.2)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', weight: 'bold' },
                    bodyFont: { family: 'Outfit' }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                    },
                    ticks: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Outfit', size: 10 }
                    },
                    title: {
                        display: true,
                        text: 'Power / Water Flow',
                        color: '#64748b',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false, // only want the grid lines for one axis
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Outfit', size: 10 }
                    },
                    title: {
                        display: true,
                        text: 'Voltage (V)',
                        color: '#64748b',
                        font: { family: 'Outfit', size: 11 }
                    }
                }
            }
        }
    });
}

// --- API Calls ---

// Load historical data from SQLite and fill tables/charts
async function loadHistory() {
    try {
        const response = await fetch('/api/history?limit=40');
        const history = await response.json();
        
        if (history.length > 0) {
            // Remove empty row
            const emptyRow = document.getElementById("empty-log-row");
            if (emptyRow) emptyRow.remove();
            
            // Clear current chart datasets
            liveChart.data.labels = [];
            liveChart.data.datasets[0].data = [];
            liveChart.data.datasets[1].data = [];
            liveChart.data.datasets[2].data = [];
            
            history.forEach(item => {
                const timeStr = formatLocalTime(item.timestamp);
                
                // Add to chart
                liveChart.data.labels.push(timeStr);
                liveChart.data.datasets[0].data.push(item.power);
                liveChart.data.datasets[1].data.push(item.water);
                liveChart.data.datasets[2].data.push(item.voltage);
                
                // Add to table
                appendRowToTable(item, false); // append to end for history
            });
            
            // Set date and weather to match the most recent historical entry on load
            const latestItem = history[history.length - 1];
            if (latestItem && latestItem.timestamp && simDateEl) {
                simDateEl.textContent = formatLocalDate(latestItem.timestamp);
            }
            if (latestItem && latestItem.temperature !== undefined && valTempEl) {
                valTempEl.textContent = latestItem.temperature.toFixed(1) + "°C";
            }
            if (latestItem && latestItem.humidity !== undefined && valHumidityEl) {
                valHumidityEl.textContent = latestItem.humidity.toFixed(0) + "%";
            }
            
            liveChart.update();
            updateLogCount();
        }
    } catch (e) {
        console.error("Failed to load history data:", e);
    }
}

// Reset all DB data
async function resetDatabase() {
    if (!confirm("Are you sure you want to delete all historical telemetry data from the database?")) {
        return;
    }
    
    try {
        const response = await fetch('/api/reset', { method: 'POST' });
        const result = await response.json();
        
        // Reset local elements
        logTbodyEl.innerHTML = `
            <tr id="empty-log-row">
                <td colspan="6" class="text-center">Database cleared. Re-connecting to grid...</td>
            </tr>
        `;
        
        liveChart.data.labels = [];
        liveChart.data.datasets.forEach(dataset => dataset.data = []);
        liveChart.update();
        
        updateLogCount();
        
        console.log(result.message);
    } catch (e) {
        console.error("Failed to reset database:", e);
    }
}

// --- WebSocket Communication ---
function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log("Connected to VoltStream Grid WebSocket!");
        const emptyRow = document.getElementById("empty-log-row");
        if (emptyRow && logTbodyEl.rows.length <= 1) {
            emptyRow.cells[0].textContent = "Connected. Awaiting telemetry stream...";
        }
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleIncomingTelemetry(data);
    };
    
    ws.onclose = () => {
        console.log("WebSocket disconnected. Retrying in 4 seconds...");
        setTimeout(connectWebSocket, 4000);
    };
    
    ws.onerror = (err) => {
        console.error("WebSocket encountered error: ", err);
        ws.close();
    };
}

// --- Render Updates ---

function handleIncomingTelemetry(data) {
    // 1. Update Real Time and Date on header
    if (data.timestamp) {
        simTimeEl.textContent = formatLocalTime(data.timestamp, false);
        simDateEl.textContent = formatLocalDate(data.timestamp);
    }
    
    // Update label to Physical System Time
    if (timeLabelEl) {
        timeLabelEl.textContent = "Physical System Time";
    }
    
    // 2. Update Live Values
    valPowerEl.textContent = data.power.toFixed(2);
    valWaterEl.textContent = data.water.toFixed(2);
    valVoltageEl.textContent = data.voltage.toFixed(1);
    
    // Update environmental inputs
    if (data.temperature !== undefined && valTempEl) {
        valTempEl.textContent = data.temperature.toFixed(1) + "°C";
    }
    if (data.humidity !== undefined && valHumidityEl) {
        valHumidityEl.textContent = data.humidity.toFixed(0) + "%";
    }
    
    // 3. Update Metric Cards Statuses
    updateCardStatus(data);
    
    // 4. Update AI Diagnostics Card UI
    updateDiagnosticsUI(data);
    
    // 5. Update Live Chart
    updateChart(formatLocalTime(data.timestamp), data.power, data.water, data.voltage);
    
    // 6. Log event to Table
    appendRowToTable(data, true); // prepend to top for real-time
    updateLogCount();
}

// Update warning borders and status labels on cards
function updateCardStatus(data) {
    // Electricity
    let pStatus = "Normal";
    let pClass = "normal";
    if (data.power > 8.0) {
        pStatus = "Overload";
        pClass = "danger";
        cardElectricityEl.style.boxShadow = "0 0 15px rgba(248, 113, 113, 0.3)";
    } else if (data.power > 3.0 && (data.simulated_hour >= 23.0 || data.simulated_hour <= 4.0)) {
        pStatus = "High Load";
        pClass = "warn";
        cardElectricityEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else if (data.is_anomalous && data.cause && data.cause.includes("High Power")) {
        pStatus = "Unusual High";
        pClass = "warn";
        cardElectricityEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else if (data.is_anomalous && data.cause && data.cause.includes("Low Power")) {
        pStatus = "Unusual Low";
        pClass = "warn";
        cardElectricityEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else {
        cardElectricityEl.style.boxShadow = "";
    }
    statusPowerEl.textContent = pStatus;
    statusPowerEl.className = `status-badge ${pClass}`;
    
    // Water
    let wStatus = "Normal";
    let wClass = "normal";
    
    // Fail-safe Water Anomaly check (matching causes or raw baseline deviations)
    const isWaterAnom = data.is_anomalous && (
        (data.cause && data.cause.toLowerCase().includes("water")) ||
        (data.cause && data.cause.toLowerCase().includes("flow")) ||
        (data.cause && data.cause.toLowerCase().includes("leak")) ||
        (data.water > 10.0) ||
        (data.water > 3.0 && !( (7.0 <= data.simulated_hour && data.simulated_hour <= 9.0) || (19.0 <= data.simulated_hour && data.simulated_hour <= 21.0) ))
    );
    
    if (data.water > 18.0) {
        wStatus = "Critical Flow";
        wClass = "danger";
        cardWaterEl.style.boxShadow = "0 0 15px rgba(248, 113, 113, 0.3)";
    } else if (data.water > 5.0 && (data.simulated_hour >= 23.0 || data.simulated_hour <= 4.0)) {
        wStatus = "Leak warning";
        wClass = "warn";
        cardWaterEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else if (isWaterAnom) {
        wStatus = "Unusual Flow";
        wClass = "warn";
        cardWaterEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else {
        cardWaterEl.style.boxShadow = "";
    }
    statusWaterEl.textContent = wStatus;
    statusWaterEl.className = `status-badge ${wClass}`;
    
    // Voltage
    let vStatus = "Normal";
    let vClass = "normal";
    if (data.voltage > 250.0) {
        vStatus = "Overvoltage";
        vClass = "danger";
        cardVoltageEl.style.boxShadow = "0 0 15px rgba(248, 113, 113, 0.3)";
    } else if (data.voltage < 195.0) {
        vStatus = "Undervoltage";
        vClass = "warn";
        cardVoltageEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else if (data.is_anomalous && data.cause && data.cause.includes("Voltage")) {
        vStatus = "Fluctuating";
        vClass = "warn";
        cardVoltageEl.style.boxShadow = "0 0 15px rgba(251, 146, 60, 0.2)";
    } else {
        cardVoltageEl.style.boxShadow = "";
    }
    statusVoltageEl.textContent = vStatus;
    statusVoltageEl.className = `status-badge ${vClass}`;
}

// Update the glowing alert box & health bar
function updateDiagnosticsUI(data) {
    if (data.is_anomalous) {
        // Warning or Critical
        const isCritical = data.severity === "critical";
        
        alertBannerEl.className = `card ai-diagnostics-card ${isCritical ? 'critical-glow' : 'warning-glow'}`;
        healthBarEl.style.width = isCritical ? '30%' : '70%';
        healthBarEl.style.background = isCritical ? 'var(--color-danger)' : 'var(--color-warning)';
        healthBarEl.style.boxShadow = isCritical ? '0 0 8px var(--color-danger)' : '0 0 8px var(--color-warning)';
        
        healthTextEl.textContent = isCritical ? '30% Critical Fault' : '70% Warning State';
        healthTextEl.style.color = isCritical ? 'var(--color-danger)' : 'var(--color-warning)';
        
        alertBoxEl.className = `alert-box ${isCritical ? 'critical' : 'warning'}`;
        alertIconEl.textContent = "⚠";
        alertTitleEl.textContent = data.cause;
        alertDescEl.textContent = data.explanation;
    } else {
        // Normal
        alertBannerEl.className = "card ai-diagnostics-card";
        healthBarEl.style.width = '100%';
        healthBarEl.style.background = 'linear-gradient(90deg, var(--color-success), #10b981)';
        healthBarEl.style.boxShadow = '0 0 8px var(--color-success)';
        
        healthTextEl.textContent = '100% Healthy';
        healthTextEl.style.color = 'var(--color-success)';
        
        alertBoxEl.className = "alert-box normal";
        alertIconEl.textContent = "✓";
        alertTitleEl.textContent = "Grid Operating Normally";
        alertDescEl.textContent = "The unsupervised Isolation Forest model has classified the current telemetry signature as normal.";
    }
}

// Push data onto Chart
function updateChart(timeStr, power, water, voltage) {
    if (!liveChart) return;
    
    // Add new data point
    liveChart.data.labels.push(timeStr);
    liveChart.data.datasets[0].data.push(power);
    liveChart.data.datasets[1].data.push(water);
    liveChart.data.datasets[2].data.push(voltage);
    
    // Maintain max width
    if (liveChart.data.labels.length > maxChartPoints) {
        liveChart.data.labels.shift();
        liveChart.data.datasets[0].data.shift();
        liveChart.data.datasets[1].data.shift();
        liveChart.data.datasets[2].data.shift();
    }
    
    liveChart.update('none'); // Update without full animation for speed
}

// Add a row to the events log table
function appendRowToTable(data, prepend = true) {
    // Remove empty row if present
    const emptyRow = document.getElementById("empty-log-row");
    if (emptyRow) emptyRow.remove();
    
    const row = document.createElement("tr");
    
    // Apply styling classes based on anomaly severity
    if (data.is_anomalous) {
        if (data.severity === "critical") {
            row.classList.add("row-critical");
        } else {
            row.classList.add("row-warning");
        }
    }
    
    const localTime = formatLocalTime(data.timestamp);
    
    // Badge html
    let badgeHtml = '<span class="badge bg-success">Normal</span>';
    if (data.is_anomalous) {
        if (data.severity === "critical") {
            badgeHtml = '<span class="badge bg-critical">Critical</span>';
        } else {
            badgeHtml = '<span class="badge bg-warning">Warning</span>';
        }
    }
    
    row.innerHTML = `
        <td>${localTime}</td>
        <td>${data.power.toFixed(2)}</td>
        <td>${data.water.toFixed(2)}</td>
        <td>${data.voltage.toFixed(1)}</td>
        <td>${badgeHtml}</td>
        <td style="font-size: 0.75rem; opacity: 0.95;">
            <strong style="color: #f1f5f9;">${data.cause}</strong> - ${data.explanation}
        </td>
    `;
    
    if (prepend) {
        logTbodyEl.insertBefore(row, logTbodyEl.firstChild);
        
        // Maintain max log items
        if (logTbodyEl.rows.length > 100) {
            logTbodyEl.removeChild(logTbodyEl.lastChild);
        }
    } else {
        logTbodyEl.appendChild(row);
    }
}

function updateLogCount() {
    const rowCount = logTbodyEl.rows.length;
    // Check if the only row is the empty message
    const emptyRow = document.getElementById("empty-log-row");
    if (emptyRow) {
        logCountEl.textContent = "0 events recorded";
    } else {
        logCountEl.textContent = `${rowCount} event${rowCount === 1 ? '' : 's'} recorded`;
    }
}

// --- Main Inits ---
document.addEventListener("DOMContentLoaded", async () => {
    initChart();
    await loadHistory();
    connectWebSocket();
});
