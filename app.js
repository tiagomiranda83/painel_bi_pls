// Inicialização Lucide Icons
lucide.createIcons();

// Elements
const loadingStatus = document.getElementById('loading-status');
const navBtns = document.querySelectorAll('.nav-btn');
const screens = document.querySelectorAll('.screen');
const themeBtns = document.querySelectorAll('.theme-btn');
const htmlEl = document.documentElement;
const activeFiltersContainer = document.getElementById('active-filters-container');
const activeFiltersBadges = document.getElementById('active-filters-badges');
const btnClearFilters = document.getElementById('btn-clear-filters');

let rawData = [];
let charts = {};
let mapChart = null;
let geoJsonData = null;

// ==========================================
// STATE MANAGEMENT & CROSS FILTERING
// ==========================================
const GlobalState = {
    filters: {
        'Eixo': null,
        'Estado': null,
        'Unidade': null
    },
    tableFilters: {
        'Eixo': '',
        'Estado': '',
        'Unidade': '',
        'Iniciativa BRUTA': '',
        'Iniciativa consolidada': ''
    },

    setFilter(key, value) {
        if (this.filters[key] === value) {
            this.filters[key] = null; // Toggle off if clicked again
        } else {
            this.filters[key] = value;
        }
        this.updateUI();
        processAndRender();
    },

    setTableFilter(key, value) {
        this.tableFilters[key] = value.toLowerCase();
        renderTable();
    },

    clearGlobalFilters() {
        this.filters = { 'Eixo': null, 'Estado': null, 'Unidade': null };
        this.updateUI();
        processAndRender();
    },

    getFilteredData() {
        return rawData.filter(row => {
            // Global Chart Filters (AND logic)
            if (this.filters['Eixo'] && row['Eixo'] !== this.filters['Eixo']) return false;
            if (this.filters['Estado'] && row['Estado'] !== this.filters['Estado']) return false;
            if (this.filters['Unidade'] && row['Unidade'] !== this.filters['Unidade']) return false;
            return true;
        });
    },

    getTableFilteredData(baseData) {
        return baseData.filter(row => {
            // Table specific text filters (AND logic)
            for (let tKey in this.tableFilters) {
                const term = this.tableFilters[tKey];
                if (term) {
                    const cellValue = String(row[tKey] || '').toLowerCase();
                    if (!cellValue.includes(term)) return false;
                }
            }
            // Add global table search term
            const globalTerm = document.getElementById('table-search').value.toLowerCase();
            if (globalTerm) {
                const matchesGlobal = Object.values(row).some(val => String(val).toLowerCase().includes(globalTerm));
                if (!matchesGlobal) return false;
            }
            return true;
        });
    },

    updateUI() {
        const active = Object.entries(this.filters).filter(([k, v]) => v !== null);
        if (active.length === 0) {
            activeFiltersContainer.style.display = 'none';
        } else {
            activeFiltersContainer.style.display = 'block';
            activeFiltersBadges.innerHTML = active.map(([k, v]) =>
                `<span style="background: var(--accent); color: var(--bg-main); padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                    ${k}: <strong>${v}</strong>
                    <i data-lucide="x" style="width: 14px; cursor: pointer;" onclick="GlobalState.setFilter('${k}', null)"></i>
                 </span>`
            ).join('');
            lucide.createIcons();
        }
    }
};

btnClearFilters.addEventListener('click', () => GlobalState.clearGlobalFilters());

document.querySelectorAll('.col-filter').forEach(input => {
    input.addEventListener('input', (e) => {
        GlobalState.setTableFilter(e.target.dataset.col, e.target.value);
    });
});
document.getElementById('table-search').addEventListener('input', () => renderTable());

// Theme switcher
themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme-val');
        htmlEl.setAttribute('data-theme', theme);
        updateAllChartsColors();
        if (mapChart) updateMapColors();
    });
});

// Navigation
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.id === 'btn-clear-filters') return;
        navBtns.forEach(b => { if (b.id !== 'btn-clear-filters') b.classList.remove('active'); });
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        screens.forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        // Resize charts that may be hidden
        Object.values(charts).forEach(c => c.resize());
        if (mapChart) mapChart.resize();
    });
});

// Load Data
async function loadData() {
    try {
        const response = await fetch('Iniciativas_Consolidadas_20260303_v02.xlsx');
        if (!response.ok) {
            throw new Error("Erro ao carregar Excel.");
        }
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        loadingStatus.textContent = "Processando Excel...";

        // Render data even if map fails
        processAndRender();

        loadingStatus.textContent = "Dados carregados com sucesso!";
        setTimeout(() => { loadingStatus.style.display = 'none'; }, 2000);

    } catch (error) {
        console.error("Critical Error Load Excel:", error);
        loadingStatus.textContent = "Erro crítico ao carregar a planilha. Verifique o console.";
        loadingStatus.style.color = "red";
        return; // Stop if Excel fails
    }

    // Load Map Layout separately so it doesn't crash the graphs if missing
    try {
        const mapRes = await fetch('br-all.geo.json');
        if (mapRes.ok) {
            geoJsonData = await mapRes.json();
            echarts.registerMap('BR', geoJsonData);
            processAndRender(); // Re-render to show map now
        }
    } catch (error) {
        console.warn("Could not load highcharts geojson:", error);
    }
}

function getCssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function getThemeColors() { return [getCssVar('--chart-color-1'), getCssVar('--chart-color-2'), getCssVar('--chart-color-3'), getCssVar('--chart-color-4'), getCssVar('--chart-color-5')]; }

function updateAllChartsColors() {
    const colors = getThemeColors();
    for (let key in charts) {
        const chart = charts[key];
        chart.data.datasets.forEach(dataset => {
            dataset.backgroundColor = colors;
            dataset.borderColor = getCssVar('--bg-main');
        });
        if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = getCssVar('--text-main');
        if (chart.options.scales?.x) {
            chart.options.scales.x.ticks.color = getCssVar('--text-muted');
            chart.options.scales.x.grid.color = getCssVar('--border-glass');
        }
        if (chart.options.scales?.y) {
            chart.options.scales.y.ticks.color = getCssVar('--text-muted');
            chart.options.scales.y.grid.color = getCssVar('--border-glass');
        }
        chart.update();
    }
}

function createOrUpdateChart(canvasId, type, labels, data, chartKey, filterField, axisConf = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const colors = getThemeColors();

    if (charts[chartKey]) {
        charts[chartKey].data.labels = labels;
        charts[chartKey].data.datasets[0].data = data;
        charts[chartKey].update();
        return;
    }

    const config = {
        type: type,
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 1, borderColor: getCssVar('--bg-main'), borderRadius: type === 'bar' ? 4 : 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const label = charts[chartKey].data.labels[idx];
                    GlobalState.setFilter(filterField, label);
                }
            },
            onHover: (e, elements) => { e.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
            plugins: {
                legend: { display: type === 'pie' || type === 'doughnut', position: 'bottom', labels: { color: getCssVar('--text-main'), font: { family: getCssVar('--font-body') } } }
            },
            ...axisConf
        }
    };
    charts[chartKey] = new Chart(ctx, config);
}

function countBy(dataArray, prop) {
    const counts = {};
    dataArray.forEach(row => {
        let val = row[prop];
        if (!val) val = "Não Informado";
        counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

const mapStateNames = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

function processAndRender() {
    const data = GlobalState.getFilteredData();

    // Update KPIs
    document.getElementById('kpi-total').textContent = data.length;
    const countEixos = countBy(data, 'Eixo');
    document.getElementById('kpi-eixos').textContent = countEixos.length;

    const countEstados = countBy(data, 'Estado');
    const countUnidades = countBy(data, 'Unidade');

    const barOptions = {
        scales: {
            x: { ticks: { color: getCssVar('--text-muted') }, grid: { color: getCssVar('--border-glass') } },
            y: { ticks: { color: getCssVar('--text-muted') }, grid: { color: getCssVar('--border-glass') } }
        },
        plugins: { legend: { display: false } }
    };
    const horizontalBarOptions = { indexAxis: 'y', scales: barOptions.scales, plugins: barOptions.plugins };

    // Charts
    createOrUpdateChart('chart-cover-eixos', 'doughnut', countEixos.slice(0, 5).map(x => x[0]), countEixos.slice(0, 5).map(x => x[1]), 'coverEixos', 'Eixo');
    createOrUpdateChart('chart-cover-estados', 'bar', countEstados.slice(0, 5).map(x => x[0]), countEstados.slice(0, 5).map(x => x[1]), 'coverEstados', 'Estado', barOptions);
    createOrUpdateChart('chart-full-eixos', 'bar', countEixos.map(x => x[0]), countEixos.map(x => x[1]), 'fullEixos', 'Eixo', horizontalBarOptions);
    createOrUpdateChart('chart-full-unidades', 'bar', countUnidades.slice(0, 10).map(x => x[0]), countUnidades.slice(0, 10).map(x => x[1]), 'fullUnidades', 'Unidade', barOptions);

    // Map ECharts
    renderMap(countEstados);

    // Table
    renderTable();
}

function updateMapColors() {
    if (mapChart) {
        const option = mapChart.getOption();
        option.visualMap[0].inRange.color = ['transparent', getCssVar('--accent')];
        option.visualMap[0].textStyle.color = getCssVar('--text-main');
        option.series[0].itemStyle.borderColor = getCssVar('--bg-main');
        mapChart.setOption(option);
    }
}

function renderMap(countEstados) {
    if (!geoJsonData) return;
    const mapData = countEstados.map(([uf, val]) => ({ name: mapStateNames[uf] || uf, value: val, ufOriginal: uf }));
    const maxVal = Math.max(...mapData.map(d => d.value), 1);

    if (!mapChart) {
        mapChart = echarts.init(document.getElementById('map-brasil'));
        mapChart.on('click', function (params) {
            if (params.data && params.data.ufOriginal) {
                GlobalState.setFilter('Estado', params.data.ufOriginal);
            }
        });
        window.addEventListener('resize', () => mapChart.resize());
    }

    mapChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}<br/>Iniciativas: {c}' },
        visualMap: {
            left: 'right', min: 0, max: maxVal,
            inRange: { color: ['transparent', getCssVar('--accent')] },
            text: ['Máx', 'Mín'], calculable: true,
            textStyle: { color: getCssVar('--text-main') }
        },
        series: [{
            name: 'Iniciativas', type: 'map', map: 'BR', roam: true,
            zoom: 1.2,
            itemStyle: { borderColor: getCssVar('--bg-main'), areaColor: 'rgba(128,128,128,0.1)' },
            emphasis: { itemStyle: { areaColor: getCssVar('--accent-hover') }, label: { show: true, color: '#fff' } },
            data: mapData
        }]
    });
}

const tableBody = document.querySelector('#data-table tbody');
const tableCount = document.getElementById('table-count');

function renderTable() {
    const dataToRender = GlobalState.getTableFilteredData(GlobalState.getFilteredData());
    tableBody.innerHTML = '';

    // render top 100 max for performance, it's vanilla DOM
    const maxRender = 100;
    const toRender = dataToRender.slice(0, maxRender);

    toRender.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row['Eixo'] || '-'}</td>
            <td>${row['Estado'] || '-'}</td>
            <td>${row['Unidade'] || '-'}</td>
            <td>${row['Iniciativa BRUTA'] || '-'}</td>
            <td>${row['Iniciativa consolidada'] || '-'}</td>
        `;
        tableBody.appendChild(tr);
    });

    let msg = `Mostrando ${toRender.length} de ${dataToRender.length} registros`;
    if (dataToRender.length > maxRender) msg += ` (Limitado aos top ${maxRender} na tela)`;
    tableCount.textContent = msg;
}

// Start
loadData();
