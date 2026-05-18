// Inicialização Lucide Icons
lucide.createIcons();

// Elements
const loadingStatus = document.getElementById('loading-status');
const globalLoader = document.getElementById('global-loader');
const navBtns = document.querySelectorAll('.nav-btn');
const screens = document.querySelectorAll('.screen');
const themeBtns = document.querySelectorAll('.theme-btn');
const htmlEl = document.documentElement;
const activeFiltersContainer = document.getElementById('active-filters-container');
const activeFiltersBadges = document.getElementById('active-filters-badges');
const btnClearFilters = document.getElementById('btn-clear-filters-sidebar');

var rawData = [];
var charts = {};
var mapChart = null;
var wordCloudChart = null;
var geoJsonData = null;

// Variáveis para Indicadores
var indicadoresData = [];
var indicadoresFilters = { Eixo: '', Fonte: '', Busca: '' };
var indPagination = { currentPage: 1, pageSize: 20 };

// ==========================================
// STATE MANAGEMENT & CROSS FILTERING
// ==========================================
const GlobalState = {
    filters: {
        'Eixo': null,
        'Estado': null,
        'Órgão': null,
        'Unidade': null
    },
    tableFilters: {
        'Eixo': '',
        'Estado': '',
        'Órgão': '',
        'Unidade': '',
        'Iniciativa consolidada': ''
    },
    pagination: {
        currentPage: 1,
        pageSize: 50
    },
    specialFilters: {
        'UnidadeGroup': null // 'MPU' or 'Outros'
    },
    // Removendo defaultEixoColors para ler direto do CSS (proporciona adaptação temática)
    customColors: {}, // Mapeamento Eixo -> Hex
    fontSize: 12,
    zoomLevel: 100,
    showLabels: true,

    setFilter(key, value) {
        if (this.filters[key] === value) {
            this.filters[key] = null; // Toggle off if clicked again
        } else {
            this.filters[key] = value;
        }
        this.pagination.currentPage = 1; // Reset pagination on filter change
        this.updateUI();
        processAndRender();
    },

    setTableFilter(key, value) {
        this.tableFilters[key] = value.toLowerCase();
        this.pagination.currentPage = 1;
        renderTable();
    },

    clearGlobalFilters() {
        this.filters = { 'Eixo': null, 'Estado': null, 'Órgão': null, 'Unidade': null };
        this.specialFilters.UnidadeGroup = null;
        this.pagination.currentPage = 1;
        this.updateUI();
        processAndRender();
    },

    getFilteredData() {
        return rawData.filter(row => {
            if (this.filters['Eixo'] && row['Eixo'] !== this.filters['Eixo']) return false;
            if (this.filters['Estado'] && row['Estado'] !== this.filters['Estado']) return false;
            if (this.filters['Órgão'] && row['Órgão'] !== this.filters['Órgão']) return false;
            if (this.filters['Unidade'] && row['Unidade'] !== this.filters['Unidade']) return false;
            
            if (this.specialFilters['UnidadeGroup']) {
                const orgao = String(row['Órgão'] || '').toUpperCase().trim();
                const isMPU = orgao.includes('MPU') || orgao.includes('MPF') || orgao.includes('MPT') || orgao.includes('MPM') || orgao.includes('CNMP');
                
                if (this.specialFilters['UnidadeGroup'] === 'MPU' && !isMPU) return false;
                if (this.specialFilters['UnidadeGroup'] === 'Outros' && isMPU) return false;
            }
            return true;
        });
    },

    getTableFilteredData(baseData) {
        return baseData.filter(row => {
            for (let tKey in this.tableFilters) {
                const term = this.tableFilters[tKey];
                if (term) {
                    const cellValue = String(row[tKey] || '').toLowerCase();
                    if (!cellValue.includes(term)) return false;
                }
            }
            const globalTerm = document.getElementById('table-search').value.toLowerCase();
            if (globalTerm) {
                const matchesGlobal = Object.values(row).some(val => String(val).toLowerCase().includes(globalTerm));
                if (!matchesGlobal) return false;
            }
            return true;
        });
    },

    updateUI() {
        let active = Object.entries(this.filters)
            .filter(([k, v]) => v !== null)
            .map(([k, v]) => [k, v]);
        
        // Incluir filtros especiais (MPU/Outros) na visualização
        if (this.specialFilters.UnidadeGroup) {
            active.push(['Grupo', this.specialFilters.UnidadeGroup]);
        }

        if (active.length === 0) {
            activeFiltersContainer.style.display = 'none';
        } else {
            activeFiltersContainer.style.display = 'block';
            activeFiltersBadges.innerHTML = active.map(([k, v]) =>
                `<div class="filter-badge" style="background: var(--accent); color: var(--bg-main); padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 4px;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${k}: <strong>${v}</strong></span>
                    <i data-lucide="x" style="width: 14px; cursor: pointer; flex-shrink: 0;" onclick="GlobalState.clearSpecificFilter('${k}')"></i>
                 </div>`
            ).join('');
            lucide.createIcons();
        }
    },
    
    clearSpecificFilter(key) {
        if (key === 'Grupo') {
            this.specialFilters.UnidadeGroup = null;
            document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        } else {
            this.filters[key] = null;
        }
        this.updateUI();
        processAndRender();
    }
};

// ==========================================
// UTILS & ANIMATIONS
// ==========================================
function getCssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error: ' + msg + '\nScript: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nStackTrace: ' + (error ? error.stack : ''));
    if (loadingStatus) {
        loadingStatus.textContent = "Erro na aplicação: " + msg;
        loadingStatus.style.color = "#ff4444";
    }
    return false;
};

function hexToRGBA(color, alpha) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    
    // Se já for rgba ou rgb
    if (color.startsWith('rgb')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }

    // Se for hex
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${isNaN(r) ? 0 : r}, ${isNaN(g) ? 0 : g}, ${isNaN(b) ? 0 : b}, ${alpha})`;
    }
    
    return `rgba(0,0,0,${alpha})`;
}

function colorToHex(color) {
    if (!color) return '#000000';
    if (color.startsWith('#')) return color;
    if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g);
        if (!rgb || rgb.length < 3) return '#000000';
        return "#" + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1).toUpperCase();
    }
    return '#000000';
}

function getThemeColors(labels) { 
    if (!labels || labels.length === 0) {
        return [getCssVar('--chart-color-1'), getCssVar('--chart-color-2'), getCssVar('--chart-color-3'), getCssVar('--chart-color-4'), getCssVar('--chart-color-5')];
    }
    // Retorna as cores mapeadas para os labels (Eixos) fornecidos
    return labels.map(label => GlobalState.customColors[label] || getCssVar('--accent'));
}

function initLegend() {
    const legendContainer = document.getElementById('legend-controls');
    if (!legendContainer) return;

    const eixos = [...new Set(rawData.map(d => d['Eixo']))].filter(Boolean).sort();
    const defaultColors = [getCssVar('--chart-color-1'), getCssVar('--chart-color-2'), getCssVar('--chart-color-3'), getCssVar('--chart-color-4'), getCssVar('--chart-color-5')];

    legendContainer.innerHTML = '';
    eixos.forEach((eixo, idx) => {
        // Cores padrão para eixos específicos vindas do CSS
        const cssMap = {
            'Energia Elétrica': '--color-energia',
            'Resíduos': '--color-residuos',
            'Água': '--color-agua'
        };

        const fallbackHex = {
            'Energia Elétrica': '#EBC06D',
            'Resíduos': '#95A5A6',
            'Água': '#3498DB'
        };

        if (!GlobalState.customColors[eixo]) {
            if (cssMap[eixo]) {
                let colorVar = getCssVar(cssMap[eixo]);
                GlobalState.customColors[eixo] = colorVar ? colorVar : fallbackHex[eixo];
            } else {
                GlobalState.customColors[eixo] = defaultColors[idx % defaultColors.length];
            }
        }

        const item = document.createElement('div');
        item.className = 'legend-item';
        // Garantir valor hex para o input type color
        const hexVal = colorToHex(GlobalState.customColors[eixo]);
        item.innerHTML = `
            <input type="color" value="${hexVal}" data-eixo="${eixo}">
            <span title="${eixo}">${eixo}</span>
        `;
        
        const input = item.querySelector('input');
        input.addEventListener('change', (e) => {
            GlobalState.customColors[eixo] = e.target.value;
            // Para manter a cor persistente MESMO se trocar de tema, vamos marcar como "custo"
            GlobalState.isCustomized = GlobalState.isCustomized || {};
            GlobalState.isCustomized[eixo] = true;
            updateAllChartsColors();
            processAndRender();
        });

        legendContainer.appendChild(item);
    });
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// DATA LOADING
// ==========================================
async function loadData() {
    try {
        const response = await fetch('Iniciativas_Consolidadas_20260309_v03.xlsx');
        if (!response.ok) {
            if (response.status === 404) throw new Error("Arquivo Excel não encontrado.");
            throw new Error(`Erro ao buscar arquivo: ${response.status} ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        if (!workbook.SheetNames.length) throw new Error("O arquivo Excel parece estar vazio.");
        
        rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        loadingStatus.textContent = "Processando Excel...";
        initLegend(); // Inicializa cores dinâmicas dos eixos
        processAndRender();

        loadingStatus.textContent = "Processando Indicadores...";
        try {
            const indRes = await fetch('indicadores_normalizado.xlsx');
            if (indRes.ok) {
                const indBuffer = await indRes.arrayBuffer();
                const indWb = XLSX.read(indBuffer, { type: 'array' });
                
                const sheetIndicadores = XLSX.utils.sheet_to_json(indWb.Sheets['Indicadores'] || indWb.Sheets[indWb.SheetNames[0]]);
                const sheetFontes = indWb.Sheets['Fontes'] ? XLSX.utils.sheet_to_json(indWb.Sheets['Fontes']) : [];
                const sheetEixos = indWb.Sheets['Eixos'] ? XLSX.utils.sheet_to_json(indWb.Sheets['Eixos']) : [];
                
                const mapFontes = {};
                sheetFontes.forEach(f => mapFontes[f.fonte_id] = f.Fonte);
                const mapEixos = {};
                sheetEixos.forEach(e => mapEixos[e.eixo_id] = e.nome_eixo);
                
                indicadoresData = sheetIndicadores.map(ind => ({
                    id: ind.indicador_id,
                    nome: ind.nome_indicador || ind.Nome || '',
                    eixo: mapEixos[ind.eixo_id] || ind.Eixo || 'N/A',
                    fonte: mapFontes[ind.fonte_id] || ind.Fonte || 'N/A',
                    requisitos: ind.requisitos || ind.Requisitos || '',
                    categoria: ind.categoria || ind.Categoria || ''
                }));
                
                initIndicadores();
            }
        } catch(e) {
            console.warn("Aviso: Falha ao carregar indicadores_normalizado.xlsx", e);
        }

        loadingStatus.textContent = "Dados Prontos!";
        
        // Premium Fade Out
        setTimeout(() => {
            if (globalLoader) {
                globalLoader.classList.add('fade-out');
                setTimeout(() => globalLoader.style.display = 'none', 600);
            }
        }, 800);

    } catch (error) {
        console.error("Critical Error Load Excel:", error);
        loadingStatus.textContent = "Erro crítico: " + error.message + " (Verifique o Console)";
        loadingStatus.style.color = "#ff4444";
        
        // Dica amigável se for erro de CORS/Network
        if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
             loadingStatus.innerHTML += "<br><small style='font-size: 0.8rem;'>Dica: Use o 'iniciar_painel.bat' para rodar o servidor local.</small>";
        }
    }

    try {
        const mapRes = await fetch('br-all.geo.json');
        if (mapRes.ok) {
            geoJsonData = await mapRes.json();
            echarts.registerMap('BR', geoJsonData);
            processAndRender();
        }
    } catch (error) {
        console.warn("Could not load highcharts geojson:", error);
    }
}

// ==========================================
// REGISTRO GLOBAL E CONFIG PLUGINS CHARTJS
// ==========================================
Chart.register(ChartDataLabels);
Chart.defaults.set('plugins.datalabels', {
    color: (context) => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'escuro' || document.documentElement.getAttribute('data-theme') === 'contraste';
        return isDark ? '#ffffff' : '#2c3e50';
    },
    font: { weight: 'bold', size: () => GlobalState.fontSize },
    formatter: Math.round,
    display: (context) => GlobalState.showLabels && context.dataset.data[context.dataIndex] > 0
});

Object.values(charts).forEach(c => {
    if (c.destroy) c.destroy();
});
charts = {};

// ==========================================
// CHARTS LOGIC
// ==========================================
function updateAllChartsColors() {
    // Se trocou o tema, precisamos atualizar as cores que NÃO foram customizadas manualmente
    const eixos = [...new Set(rawData.map(d => d['Eixo']))].filter(Boolean).sort();
    const defaultColors = [getCssVar('--chart-color-1'), getCssVar('--chart-color-2'), getCssVar('--chart-color-3'), getCssVar('--chart-color-4'), getCssVar('--chart-color-5')];
    const cssMap = { 'Energia Elétrica': '--color-energia', 'Resíduos': '--color-residuos', 'Água': '--color-agua' };

    const fallbackHex = { 'Energia Elétrica': '#EBC06D', 'Resíduos': '#95A5A6', 'Água': '#3498DB' };

    eixos.forEach((eixo, idx) => {
        if (!GlobalState.isCustomized || !GlobalState.isCustomized[eixo]) {
            if (cssMap[eixo]) {
                let colorVar = getCssVar(cssMap[eixo]);
                GlobalState.customColors[eixo] = colorVar ? colorVar : fallbackHex[eixo];
            } else {
                GlobalState.customColors[eixo] = defaultColors[idx % defaultColors.length];
            }
            // Atualizar o input de cor se existir (Garantir valor hex)
            const input = document.querySelector(`input[data-eixo="${eixo}"]`);
            if (input) input.value = colorToHex(GlobalState.customColors[eixo]);
        }
    });

    for (let key in charts) {
        const chart = charts[key];
        // Pular se for ECharts (como o heatmap)
        if (chart.setOption) continue;
        
        const labels = chart.data.labels;
        const colors = getThemeColors(labels);
        
        chart.data.datasets.forEach(dataset => {
            if (key === 'coverEixos' || key === 'fullEixos') {
                // A cor de cada fatia ou barra depende especificamente da label e da escala estratégica
                dataset.backgroundColor = labels.map(label => GlobalState.customColors[label] || colors[0]);
            } else if (key === 'fullUnidades' || key === 'pareto') {
                // Evitar escala arco-íris nesses gráficos para não confundir com os Eixos. Cor neutra unificada.
                dataset.backgroundColor = getCssVar('--accent');
            } else if (dataset.label && GlobalState.customColors[dataset.label]) {
                // Gráficos empilhados usam o dataset.label como nome de Eixo
                dataset.backgroundColor = GlobalState.customColors[dataset.label];
            } else {
                // Outros recebem paleta rotacionada
                dataset.backgroundColor = colors;
            }
            dataset.borderColor = getCssVar('--bg-main');
        });
        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) chart.options.plugins.legend.labels.color = getCssVar('--text-main');
        if (chart.options.scales && chart.options.scales.x) {
            chart.options.scales.x.ticks.color = getCssVar('--text-muted');
            chart.options.scales.x.grid.color = getCssVar('--border-glass');
        }
        if (chart.options.scales?.y) {
            chart.options.scales.y.ticks.color = getCssVar('--text-muted');
            chart.options.scales.y.grid.color = getCssVar('--border-glass');
        }
        chart.update();
    }
    // Update ECharts
    if (mapChart) updateMapColors();
    if (wordCloudChart) renderWordCloud(GlobalState.getFilteredData());
    if (charts.heatmap) renderHeatmap(GlobalState.getFilteredData());
}

function createOrUpdateChart(canvasId, type, labels, data, chartKey, filterField, axisConf = {}) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const ctx = el.getContext('2d');
    const colors = getThemeColors();

    if (charts[chartKey]) {
        charts[chartKey].data.labels = labels;
        if (typeof data[0] === 'object' && data[0] !== null) {
            charts[chartKey].data.datasets = data;
        } else {
            charts[chartKey].data.datasets[0].data = data;
            // Garantir que cores customizadas sejam aplicadas na atualização
            if (axisConf.customDatasetColors) {
                charts[chartKey].data.datasets[0].backgroundColor = axisConf.customDatasetColors;
            } else {
                charts[chartKey].data.datasets[0].backgroundColor = colors;
            }
        }
        charts[chartKey].update();
        return;
    }

    const config = {
        type: type,
        data: {
            labels: labels,
            datasets: (typeof data[0] === 'object' && data[0] !== null) ? data : [{ 
                label: 'Iniciativas',
                data: data, 
                backgroundColor: axisConf.customDatasetColors || colors, 
                borderWidth: 1, 
                borderColor: getCssVar('--bg-main'), 
                borderRadius: type === 'bar' ? 4 : 0 
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const dsIdx = elements[0].datasetIndex;
                    const label = charts[chartKey].data.labels[idx];
                    
                    if (Array.isArray(data[0]) && typeof data[0] === 'object' && charts[chartKey].data.datasets[dsIdx].label) {
                        GlobalState.setFilter('Eixo', charts[chartKey].data.datasets[dsIdx].label);
                    }
                    
                    GlobalState.setFilter(filterField, label);
                }
            },
            plugins: {
                legend: { 
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#000',
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    boxPadding: 6,
                    usePointStyle: true
                },
                datalabels: {
                    color: (context) => {
                        if (axisConf.plugins && axisConf.plugins.datalabels && axisConf.plugins.datalabels.color) {
                            return axisConf.plugins.datalabels.color;
                        }
                        const isDark = document.documentElement.getAttribute('data-theme') === 'escuro' || document.documentElement.getAttribute('data-theme') === 'contraste';
                        return isDark ? '#ffffff' : '#2c3e50';
                    },
                    font: { weight: 'bold', size: () => GlobalState.fontSize },
                    formatter: Math.round,
                    display: (context) => {
                        if (!GlobalState.showLabels) return false;
                        const val = context.dataset.data[context.dataIndex];
                        if (!val || val <= 0) return false;
                        
                        // Ocultação inteligente para modo banca/empilhado
                        if (axisConf.scales && axisConf.scales.x && axisConf.scales.x.stacked) {
                            if (val < 5) return false; // muito espremido
                        }
                        return true;
                    },
                    anchor: (axisConf.plugins && axisConf.plugins.datalabels && axisConf.plugins.datalabels.anchor) || 'center',
                    align: (axisConf.plugins && axisConf.plugins.datalabels && axisConf.plugins.datalabels.align) || 'center'
                }
            },
            scales: axisConf.scales || {},
            indexAxis: axisConf.indexAxis || 'x'
        },
        plugins: [ChartDataLabels]
    };
    

    charts[chartKey] = new Chart(ctx, config);
}

const mapStateNames = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

function processAndRender() {
    const data = GlobalState.getFilteredData();

    // Update KPIs with animation
    const oldTotal = parseInt(document.getElementById('kpi-total').textContent) || 0;
    animateValue('kpi-total', oldTotal, data.length, 1000);

    const countEixos = countBy(data, 'Eixo');
    const oldEixos = parseInt(document.getElementById('kpi-eixos').textContent) || 0;
    animateValue('kpi-eixos', oldEixos, countEixos.length, 1000);

    const countEstados = countBy(data, 'Estado');
    const countUnidades = countBy(data, 'Unidade');
    
    // Novos KPIs
    const uniqueStates = [...new Set(data.map(d => d['Estado']))].filter(Boolean).length;
    const uniqueUnits = [...new Set(data.map(d => d['Unidade']))].filter(Boolean).length;
    animateValue('kpi-estados-count', 0, uniqueStates, 1000);
    animateValue('kpi-orgaos-count', 0, uniqueUnits, 1000);

    // Preparar Dados Empilhados para Estados (Garantir que os datasets existam mesmo sem dados)
    const top5States = countEstados.slice(0, 5).map(x => x[0]);
    const eixosList = countEixos.map(x => x[0]);
    
    const stackedData = eixosList.map((eixo, i) => ({
        label: eixo,
        data: top5States.map(state => data.filter(d => d['Estado'] === state && d['Eixo'] === eixo).length),
        backgroundColor: GlobalState.customColors[eixo] || getThemeColors()[i % 5],
        stack: 'stack0'
    }));

    const barOptions = {
        scales: {
            x: { stacked: true, ticks: { color: getCssVar('--text-muted') }, grid: { color: getCssVar('--border-glass') } },
            y: { stacked: true, ticks: { color: getCssVar('--text-muted') }, grid: { color: getCssVar('--border-glass') } }
        },
        plugins: { 
            legend: { display: false },
            datalabels: {
                anchor: 'center',
                align: 'center',
                color: '#ffffff'
            }
        }
    };
    const horizontalBarOptions = { 
        indexAxis: 'y', 
        scales: barOptions.scales, 
        plugins: { 
            ...barOptions.plugins,
            datalabels: {
                anchor: 'end',
                align: 'start',
                color: '#ffffff'
            }
        }
    };

    const barEixosColors = countEixos.map(x => GlobalState.customColors[x[0]] || getCssVar('--accent'));
    const doughnutEixosColors = countEixos.slice(0, 5).map(x => GlobalState.customColors[x[0]] || getCssVar('--accent'));

    createOrUpdateChart('chart-cover-eixos', 'doughnut', countEixos.slice(0, 5).map(x => x[0]), countEixos.slice(0, 5).map(x => x[1]), 'coverEixos', 'Eixo', {
        customDatasetColors: doughnutEixosColors
    });
    createOrUpdateChart('chart-cover-estados', 'bar', top5States, stackedData, 'coverEstados', 'Estado', barOptions);
    createOrUpdateChart('chart-full-eixos', 'bar', countEixos.map(x => x[0]), countEixos.map(x => x[1]), 'fullEixos', 'Eixo', { 
        ...horizontalBarOptions,
        customDatasetColors: barEixosColors
    });
    createOrUpdateChart('chart-full-unidades', 'bar', countUnidades.slice(0, 10).map(x => x[0]), countUnidades.slice(0, 10).map(x => x[1]), 'fullUnidades', 'Unidade', { 
        ...horizontalBarOptions,
        customDatasetColors: getCssVar('--accent')
    });

    renderMap(countEstados);
    renderWordCloud(data);
    renderTable();
    updateGeoDetailsPanel();
    renderInsights(data);

    // Force resize for ECharts after DOM settles
    setTimeout(() => {
        if (mapChart) mapChart.resize();
        if (wordCloudChart) wordCloudChart.resize();
        if (charts.heatmap) charts.heatmap.resize();
    }, 100);
}

// ==========================================
// INSIGHTS STRATEGICOS
// ==========================================
function renderInsights(data) {
    renderPareto(data);
    renderHeatmap(data);
}

function renderPareto(data) {
    const counts = countBy(data, 'Órgão');
    counts.sort((a, b) => b[1] - a[1]);
    
    const labels = counts.map(x => x[0]);
    const values = counts.map(x => x[1]);

    const dataset = [
        {
            label: 'Volume por Órgão',
            data: values,
            backgroundColor: getCssVar('--accent'),
            borderRadius: 6
        }
    ];

    const options = {
        scales: {
            y: { 
                beginAtZero: true,
                title: { display: true, text: 'Qtd Iniciativas' }, 
                grid: { color: getCssVar('--border-glass') } 
            }
        },
        plugins: {
            datalabels: {
                anchor: 'end',
                align: 'end',
                color: (context) => {
                    const isDark = document.documentElement.getAttribute('data-theme') === 'escuro' || document.documentElement.getAttribute('data-theme') === 'contraste';
                    return isDark ? '#ffffff' : '#2c3e50';
                }
            }
        }
    };

    createOrUpdateChart('chart-pareto-orgaos', 'bar', labels, dataset, 'pareto', 'Órgão', options);
}

function renderHeatmap(data) {
    const el = document.getElementById('chart-heatmap-eixo-orgao');
    if (!el) return;
    
    if (!charts.heatmap) {
        charts.heatmap = echarts.init(el);
        window.addEventListener('resize', () => charts.heatmap && charts.heatmap.resize());
    }

    const eixos = [...new Set(rawData.map(d => d['Eixo']))].filter(Boolean);
    const orgaos = [...new Set(rawData.map(d => d['Órgão']))].filter(Boolean).slice(0, 10); // Limitar top 10 para visualização

    const heatmapData = [];
    let maxVal = 0;
    orgaos.forEach(org => {
        eixos.forEach(eixo => {
            const val = data.filter(d => d['Órgão'] === org && d['Eixo'] === eixo).length;
            if (val > maxVal) maxVal = val;
        });
    });

    orgaos.forEach((org, orgIdx) => {
        eixos.forEach((eixo, eixoIdx) => {
            const val = data.filter(d => d['Órgão'] === org && d['Eixo'] === eixo).length;
            const eixoColor = GlobalState.customColors[eixo] || getCssVar('--accent');
            // Calcula intensidade baseada no valor (min 10% opacity se val > 0)
            const alpha = val > 0 ? Math.max(0.1, val / maxVal) : 0;
            
            heatmapData.push({
                value: [eixoIdx, orgIdx, val || '-'],
                itemStyle: { color: hexToRGBA(eixoColor, alpha) },
                label: {
                    show: GlobalState.showLabels && val > 0,
                    textStyle: {
                        color: getCssVar('--text-main'),
                        fontSize: GlobalState.fontSize,
                        fontWeight: 'bold',
                        textShadowColor: getCssVar('--bg-glass'),
                        textShadowBlur: 2
                    }
                }
            });
        });
    });

    const option = {
        tooltip: { position: 'top' },
        grid: { height: '70%', top: '15%', left: '15%' },
        xAxis: { 
            type: 'category', 
            data: eixos, 
            splitArea: { show: true }, 
            axisLabel: { 
                interval: 0, 
                rotate: 30,
                color: (val) => GlobalState.customColors[val] || getCssVar('--text-main'),
                fontWeight: 'bold'
            } 
        },
        yAxis: { type: 'category', data: orgaos, splitArea: { show: true } },
        visualMap: { show: false }, // Desativado pois usamos cores manuais por Eixo
        series: [{
            name: 'Volume',
            type: 'heatmap',
            data: heatmapData,
            label: { show: true, color: '#2c3e50', fontWeight: 'bold' },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
        }]
    };

    charts.heatmap.setOption(option);
}

function updateInsightsHighlights(data) {
    const container = document.getElementById('insights-highlights');
    if (!container) return;

    const countsOrg = countBy(rawData, 'Órgão');
    const leaderOrg = countsOrg[0] ? countsOrg[0][0] : '-';
    const leaderVal = countsOrg[0] ? countsOrg[0][1] : 0;

    const countsState = countBy(rawData, 'Estado');
    const leaderState = countsState[0] ? countsState[0][0] : '-';

    const eixosPerOrg = {};
    rawData.forEach(d => {
        if (!eixosPerOrg[d['Órgão']]) eixosPerOrg[d['Órgão']] = new Set();
        if (d['Eixo']) eixosPerOrg[d['Órgão']].add(d['Eixo']);
    });
    
    let maxDiversityOrg = '-';
    let maxDiversityVal = 0;
    Object.entries(eixosPerOrg).forEach(([org, set]) => {
        if (set.size > maxDiversityVal) {
            maxDiversityVal = set.size;
            maxDiversityOrg = org;
        }
    });

    container.innerHTML = `
        <div class="insight-card">
            <div class="icon-box"><i data-lucide="award"></i></div>
            <h4>Órgão Líder</h4>
            <p>${leaderOrg}</p>
            <span class="trend">${leaderVal} iniciativas totais</span>
        </div>
        <div class="insight-card">
            <div class="icon-box"><i data-lucide="map"></i></div>
            <h4>Estado em Destaque</h4>
            <p>${leaderState}</p>
            <span class="trend">Maior volume geográfico</span>
        </div>
        <div class="insight-card">
            <div class="icon-box"><i data-lucide="zap"></i></div>
            <h4>Maior Diversidade</h4>
            <p>${maxDiversityOrg}</p>
            <span class="trend">Atua em ${maxDiversityVal} eixos estratégicos</span>
        </div>
        <div class="insight-card">
            <div class="icon-box"><i data-lucide="target"></i></div>
            <h4>Foco Atual</h4>
            <p>${countBy(data, 'Eixo')[0] ? countBy(data, 'Eixo')[0][0] : '-'}</p>
            <span class="trend">Eixo com mais ações filtradas</span>
        </div>
    `;
    lucide.createIcons();
}

// ==========================================
// WORDCLOUD & MAP
// ==========================================
function updateMapColors() {
    if (mapChart) {
        const option = mapChart.getOption();
        option.visualMap.inRange.color = ['transparent', getCssVar('--accent')];
        option.series[0].itemStyle.borderColor = getCssVar('--bg-main');
        mapChart.setOption(option);
    }
}

function renderWordCloud(data) {
    if (!wordCloudChart) {
        let el = document.getElementById('chart-wordcloud');
        if (!el) return;
        wordCloudChart = echarts.init(el);
        window.addEventListener('resize', () => wordCloudChart && wordCloudChart.resize());
        // Interação de tabela removida. A nuvem serve apenas a critério informativo visual nesta versão.
    }

    const stopWords = ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'vocês', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas', 'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'aquilo', 'estou', 'estamos', 'estive', 'esteve', 'estivemos', 'estiveram', 'estava', 'estávamos', 'estavam', 'estivera', 'estivéramos', 'esteja', 'estejamos', 'estejam', 'estivesse', 'estivéssemos', 'estivessem', 'estiver', 'estivermos', 'estiverem', 'hei', 'há', 'havemos', 'hão', 'houve', 'houvemos', 'houveram', 'houvera', 'houvéramos', 'haja', 'hajamos', 'hajam', 'houvesse', 'houvéssemos', 'houvessem', 'houver', 'houvermos', 'houverem', 'houverei', 'houverá', 'houveremos', 'houverão', 'houveria', 'houveríamos', 'houveriam', 'sou', 'somos', 'são', 'era', 'éramos', 'eram', 'fui', 'foi', 'fomos', 'foram', 'fora', 'fôramos', 'seja', 'sejamos', 'sejam', 'fosse', 'fôssemos', 'fossem', 'for', 'formos', 'forem', 'serei', 'será', 'seremos', 'serão', 'seria', 'seríamos', 'seriam', 'tenho', 'tem', 'temos', 'tém', 'tinha', 'tínhamos', 'tinham', 'tive', 'teve', 'tivemos', 'tiveram', 'tivera', 'tivéramos', 'tenha', 'tenhamos', 'tenham', 'tivesse', 'tivéssemos', 'tivessem', 'tiver', 'tivermos', 'tiverem', 'terei', 'terá', 'teremos', 'terão', 'teria', 'teríamos', 'teriam'];
    const wordCounts = {};
    data.forEach(row => {
        const text = (row['Iniciativa BRUTA'] || '') + " " + (row['Iniciativa consolidada'] || '');
        // Substituindo pontuações por espaço para não colar palavras (ex: adequação/substituição)
        text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ").split(/\s+/).forEach(word => {
            if (word.length > 3 && !stopWords.includes(word)) wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
    });

    const topWords = Object.entries(wordCounts).sort((a,b) => b[1]-a[1]).slice(0, 150).map(w => ({ name: w[0], value: w[1] }));
    wordCloudChart.setOption({
        tooltip: { show: true },
        series: [{
            type: 'wordCloud', shape: 'circle', keepAspect: true, width: '100%', height: '100%',
            sizeRange: [10, 60], rotationRange: [-90, 90], gridSize: 4, drawOutOfBound: true,
            textStyle: { 
                fontFamily: getCssVar('--font-heading'), 
                fontWeight: 'bold', 
                color: () => {
                    if (GlobalState.filters['Eixo']) return GlobalState.customColors[GlobalState.filters['Eixo']];
                    const colors = Object.values(GlobalState.customColors);
                    return colors.length ? colors[Math.floor(Math.random() * colors.length)] : getCssVar('--accent');
                }
            },
            data: topWords
        }]
    });
}

function renderMap(countEstados) {
    if (!geoJsonData) return;
    const mapData = countEstados.map(([uf, val]) => ({ name: mapStateNames[uf] || uf, value: val, ufOriginal: uf }));
    const maxVal = Math.max(...mapData.map(d => d.value), 1);

    if (!mapChart) {
        mapChart = echarts.init(document.getElementById('map-brasil'));
        mapChart.on('click', (params) => {
            if (params.data && params.data.ufOriginal) {
                const uf = params.data.ufOriginal;
                GlobalState.setFilter('Estado', uf);
                updateGeoDetails(uf, params.data.name);
            }
        });
        window.addEventListener('resize', () => mapChart && mapChart.resize());
    }

    mapChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}<br/>Iniciativas: {c}' },
        visualMap: { show: false, min: 0, max: maxVal, inRange: { color: ['transparent', getCssVar('--accent')] } },
        series: [{ type: 'map', map: 'BR', roam: true, zoom: 1.1, itemStyle: { borderColor: getCssVar('--bg-main'), areaColor: 'rgba(128,128,128,0.1)' }, emphasis: { itemStyle: { areaColor: getCssVar('--accent-hover') }, label: { show: true, color: '#fff' } }, data: mapData }]
    }, true);
}

function updateGeoDetailsPanel() {
    const selectedState = GlobalState.filters['Estado'];
    const container = document.getElementById('geo-details-content');
    if (!container) return;

    if (selectedState) {
        updateGeoDetails(selectedState, mapStateNames[selectedState] || selectedState);
    } else {
        container.innerHTML = `<p class="empty-msg">Clique em um estado no mapa para ver o detalhamento.</p>`;
    }
}

function updateGeoDetails(uf, stateName) {
    const container = document.getElementById('geo-details-content');
    if (!container) return;
    
    const stateData = rawData.filter(d => d['Estado'] === uf);
    if (stateData.length === 0) {
        container.innerHTML = `<p class="empty-msg">Nenhuma iniciativa encontrada para ${stateName}.</p>`;
        return;
    }

    container.innerHTML = `<h4 style="margin-bottom:15px; color:var(--text-main)">${stateName} (${stateData.length} iniciativas)</h4>`;
    
    // Agrupar por eixo para o detalhamento lateral
    const components = {};
    stateData.forEach(d => {
        const eixo = d['Eixo'] || 'Outros';
        if (!components[eixo]) components[eixo] = [];
        components[eixo].push(d['Iniciativa consolidada'] || d['Iniciativa BRUTA']);
    });

    Object.entries(components).forEach(([eixo, items]) => {
        const div = document.createElement('div');
        div.className = 'geo-detail-item';
        const eixoColor = GlobalState.customColors[eixo] || getCssVar('--accent');
        div.innerHTML = `
            <h5 style="color: ${eixoColor}">${eixo}</h5>
            <p>${items.length} ação(ões) capturada(s). Clique para ver na base de dados.</p>
        `;
        div.style.cursor = 'pointer';
        div.onclick = () => {
            GlobalState.setFilter('Eixo', eixo);
            navBtns.forEach(b => { if (b.getAttribute('data-target') === 'screen-data') b.click(); });
        };
        container.appendChild(div);
    });
}



const btnFontMinus = document.getElementById('btn-font-minus');
const btnFontPlus = document.getElementById('btn-font-plus');
const fontSizeVal = document.getElementById('font-size-val');

if (btnFontPlus && btnFontMinus) {
    btnFontPlus.addEventListener('click', () => {
        GlobalState.zoomLevel = Math.min(150, GlobalState.zoomLevel + 5);
        applyGlobalZoom();
    });
    btnFontMinus.addEventListener('click', () => {
        GlobalState.zoomLevel = Math.max(50, GlobalState.zoomLevel - 5);
        applyGlobalZoom();
    });
}

function applyGlobalZoom() {
    fontSizeVal.textContent = GlobalState.zoomLevel + '%';
    // O recurso CSS zoom atende bem à maioria dos casos e aumenta tudo visualmente
    document.body.style.zoom = (GlobalState.zoomLevel / 100).toString();
    
    // Atualiza a fonte base dos labels proporcionalmente para garantir que o DataLabels e o ECharts acompanhem a clareza
    GlobalState.fontSize = Math.round(12 * (GlobalState.zoomLevel / 100));
    updateAllChartsFontSize();
}

function updateAllChartsFontSize() {
    // Atualiza ChartJS
    for (let key in charts) {
        const chart = charts[key];
        if (chart.setOption) continue;
        chart.update(); // O ChartJS vai repuxar dinamicamente pela query do fontSize no datalabels
    }
    // Atualiza ECharts
    if (mapChart) {
        mapChart.setOption({
            series: [{ label: { show: GlobalState.showLabels, textStyle: { fontSize: GlobalState.fontSize } } }]
        });
    }
    if (heatmapChart) {
        // Usa Merge raso do ECharts para não reconstruir o canvas do zero e evitar call stack loops
        heatmapChart.setOption({
            series: [{
                label: {
                    show: GlobalState.showLabels,
                    textStyle: { fontSize: GlobalState.fontSize } 
                }
            }]
        });
    }
}



// ==========================================
// TABLE & PAGINATION
// ==========================================
const tableBody = document.querySelector('#data-table tbody');
const tableCount = document.getElementById('table-count');
const pageIndicator = document.getElementById('page-indicator');

function renderTable() {
    const fullData = GlobalState.getTableFilteredData(GlobalState.getFilteredData());
    const totalPages = Math.ceil(fullData.length / GlobalState.pagination.pageSize) || 1;
    
    if (GlobalState.pagination.currentPage > totalPages) GlobalState.pagination.currentPage = totalPages;
    
    const start = (GlobalState.pagination.currentPage - 1) * GlobalState.pagination.pageSize;
    const end = start + GlobalState.pagination.pageSize;
    const dataToRender = fullData.slice(start, end);

    tableBody.innerHTML = '';
    dataToRender.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row['Eixo'] || '-'}</td><td>${row['Estado'] || '-'}</td><td>${row['Órgão'] || '-'}</td><td>${row['Unidade'] || '-'}</td><td>${row['Iniciativa consolidada'] || '-'}</td>`;
        tableBody.appendChild(tr);
    });

    tableCount.textContent = `Mostrando ${start + 1} - ${Math.min(end, fullData.length)} de ${fullData.length} registros`;
    pageIndicator.textContent = `Página ${GlobalState.pagination.currentPage} de ${totalPages}`;
}

// ==========================================
// INDICADORES LOGIC
// ==========================================
function initIndicadores() {
    const selectEixo = document.getElementById('filter-indicadores-eixo');
    const selectFonte = document.getElementById('filter-indicadores-fonte');

    if (!selectEixo || !selectFonte) return;

    // Contar ocorrências por Eixo e Fonte
    const eixoCount = {};
    const fonteCount = {};
    indicadoresData.forEach(d => {
        eixoCount[d.eixo] = (eixoCount[d.eixo] || 0) + 1;
        fonteCount[d.fonte] = (fonteCount[d.fonte] || 0) + 1;
    });

    // Limpar e popular selects com contagem
    selectEixo.innerHTML = '<option value="">Todos os Eixos</option>';
    Object.entries(eixoCount).sort((a, b) => a[0].localeCompare(b[0])).forEach(([e, n]) => {
        selectEixo.add(new Option(`${e} (${n})`, e));
    });

    selectFonte.innerHTML = '<option value="">Todas as Fontes</option>';
    Object.entries(fonteCount).sort((a, b) => a[0].localeCompare(b[0])).forEach(([f, n]) => {
        selectFonte.add(new Option(`${f} (${n})`, f));
    });

    // Event listeners dos filtros
    selectEixo.addEventListener('change', (e) => {
        indicadoresFilters.Eixo = e.target.value;
        indPagination.currentPage = 1;
        renderIndicadores();
    });
    selectFonte.addEventListener('change', (e) => {
        indicadoresFilters.Fonte = e.target.value;
        indPagination.currentPage = 1;
        renderIndicadores();
    });

    // Busca textual
    const searchInput = document.getElementById('search-indicadores');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            indicadoresFilters.Busca = e.target.value.toLowerCase();
            indPagination.currentPage = 1;
            renderIndicadores();
        });
    }

    // Botão limpar
    const btnLimpar = document.getElementById('btn-limpar-indicadores');
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            indicadoresFilters = { Eixo: '', Fonte: '', Busca: '' };
            selectEixo.value = '';
            selectFonte.value = '';
            if (searchInput) searchInput.value = '';
            indPagination.currentPage = 1;
            renderIndicadores();
        });
    }

    // Paginação
    const btnPrev = document.getElementById('btn-ind-prev');
    const btnNext = document.getElementById('btn-ind-next');
    if (btnPrev) btnPrev.addEventListener('click', () => {
        if (indPagination.currentPage > 1) { indPagination.currentPage--; renderIndicadores(); }
    });
    if (btnNext) btnNext.addEventListener('click', () => {
        const filtrado = getIndicadoresFiltrados();
        const totalPages = Math.ceil(filtrado.length / indPagination.pageSize) || 1;
        if (indPagination.currentPage < totalPages) { indPagination.currentPage++; renderIndicadores(); }
    });

    // Exportar
    const btnExport = document.getElementById('btn-export-indicadores');
    if (btnExport) {
        btnExport.addEventListener('click', () => exportIndicadoresExcel());
    }

    renderIndicadores();
}

function getIndicadoresFiltrados() {
    return indicadoresData.filter(d => {
        if (indicadoresFilters.Eixo && d.eixo !== indicadoresFilters.Eixo) return false;
        if (indicadoresFilters.Fonte && d.fonte !== indicadoresFilters.Fonte) return false;
        if (indicadoresFilters.Busca) {
            const termo = indicadoresFilters.Busca;
            const match = (
                (d.nome || '').toLowerCase().includes(termo) ||
                (d.eixo || '').toLowerCase().includes(termo) ||
                (d.fonte || '').toLowerCase().includes(termo) ||
                (d.categoria || '').toLowerCase().includes(termo) ||
                (d.requisitos || '').toLowerCase().includes(termo)
            );
            if (!match) return false;
        }
        return true;
    });
}

function renderIndicadores() {
    const filtered = getIndicadoresFiltrados();

    // KPIs
    const kpiTotal = document.getElementById('kpi-total-indicadores');
    if (kpiTotal) kpiTotal.textContent = filtered.length;

    const kpiEixos = document.getElementById('kpi-eixos-indicadores');
    if (kpiEixos) kpiEixos.textContent = [...new Set(filtered.map(d => d.eixo))].length;

    const kpiFontes = document.getElementById('kpi-fontes-indicadores');
    if (kpiFontes) kpiFontes.textContent = [...new Set(filtered.map(d => d.fonte))].length;

    // Gráfico por Eixo
    const eixosCount = {};
    filtered.forEach(d => eixosCount[d.eixo] = (eixosCount[d.eixo] || 0) + 1);
    const sortedEixos = Object.entries(eixosCount).sort((a, b) => b[1] - a[1]);
    const labels = sortedEixos.map(x => x[0]);
    const data = sortedEixos.map(x => x[1]);
    const colors = labels.map(l => GlobalState.customColors[l] || getCssVar('--accent'));

    createOrUpdateChart('chart-indicadores-eixos', 'bar', labels, data, 'indicadoresEixos', 'Eixo', {
        customDatasetColors: colors,
        plugins: { datalabels: { color: '#ffffff', anchor: 'center', align: 'center' } },
        indexAxis: 'y',
        scales: {
            x: { ticks: { color: getCssVar('--text-muted') }, grid: { color: getCssVar('--border-glass') }, beginAtZero: true },
            y: { ticks: { color: getCssVar('--text-muted') } }
        }
    });

    // Contagem
    const countEl = document.getElementById('indicadores-count');
    if (countEl) {
        const total = filtered.length;
        const totalPages = Math.ceil(total / indPagination.pageSize) || 1;
        const start = (indPagination.currentPage - 1) * indPagination.pageSize + 1;
        const end = Math.min(indPagination.currentPage * indPagination.pageSize, total);
        countEl.textContent = total === 0 ? 'Nenhum indicador encontrado' : `Mostrando ${start}–${end} de ${total} indicadores`;
    }

    // Paginação
    const totalPages = Math.ceil(filtered.length / indPagination.pageSize) || 1;
    if (indPagination.currentPage > totalPages) indPagination.currentPage = totalPages;
    const pageIndicator = document.getElementById('ind-page-indicator');
    if (pageIndicator) pageIndicator.textContent = `Página ${indPagination.currentPage} de ${totalPages}`;

    const start = (indPagination.currentPage - 1) * indPagination.pageSize;
    const pageData = filtered.slice(start, start + indPagination.pageSize);

    // Tabela
    const tbody = document.getElementById('indicadores-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="indicadores-empty">
                        <i data-lucide="search-x"></i>
                        <p>Nenhum indicador encontrado para os filtros selecionados.</p>
                    </div>
                </td>
            </tr>`;
        lucide.createIcons();
        return;
    }

    pageData.forEach(row => {
        const cor = GlobalState.customColors[row.eixo] || getCssVar('--accent');
        // Garantir cor hex para o badge
        const corHex = colorToHex(cor);
        const reqTruncado = (row.requisitos || '').length > 80
            ? (row.requisitos || '').substring(0, 80) + '…'
            : (row.requisitos || '-');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center; font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">${row.id || '-'}</td>
            <td style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${row.nome || '-'}</td>
            <td><span class="eixo-badge" style="background-color: ${corHex};" title="${row.eixo}">${row.eixo}</span></td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${row.categoria || '-'}</td>
            <td class="req-cell" title="${(row.requisitos || '').replace(/"/g, '&quot;')}">${reqTruncado}</td>`;
        tbody.appendChild(tr);
    });
}

function exportIndicadoresExcel() {
    const filtered = getIndicadoresFiltrados();
    if (filtered.length === 0) return alert('Não há indicadores para exportar com os filtros atuais.');

    const exportData = filtered.map(row => ({
        'ID': row.id || '',
        'Nome do Indicador': row.nome || '',
        'Eixo Estratégico': row.eixo || '',
        'Fonte': row.fonte || '',
        'Categoria': row.categoria || '',
        'Requisitos': row.requisitos || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicadores');
    XLSX.writeFile(wb, 'BI_Indicadores_Sustentabilidade.xlsx');
}

// ==========================================
// EXPORT LOGIC
// ==========================================
function exportToExcel() {
    const scope = document.querySelector('input[name="export-scope"]:checked').value;
    const data = scope === 'all' ? rawData : GlobalState.getTableFilteredData(GlobalState.getFilteredData());
    
    if (data.length === 0) return alert("Não há dados para exportar com os filtros atuais.");
    
    const exportData = data.map(row => ({
        'Eixo': row['Eixo'] || '',
        'Estado': row['Estado'] || '',
        'Órgão': row['Órgão'] || '',
        'Unidade': row['Unidade'] || '',
        'Iniciativa Consolidada': row['Iniciativa consolidada'] || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Iniciativas");
    XLSX.writeFile(wb, "BI_PLS_Export.xlsx");
}

function exportToPDF() {
    const scope = document.querySelector('input[name="export-scope"]:checked').value;
    const data = scope === 'all' ? rawData : GlobalState.getTableFilteredData(GlobalState.getFilteredData());
    
    if (data.length === 0) return alert("Não há dados para exportar com os filtros atuais.");
    
    // Simplificado: abre a janela de impressão focada na tabela com estilo premium
    const printWindow = window.open('', '_blank');
    const activeText = document.getElementById('modal-active-filters-text').textContent;
    let html = `<html><head><title>Relatório BI PLS</title><style>
        @page { size: landscape; margin: 15mm; }
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 0; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #2c3e50; margin: 0; font-size: 24px; }
        .header p { margin: 0; font-size: 12px; color: #666; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        th, td { border: 1px solid #e0e0e0; padding: 10px 8px; text-align: left; }
        th { background-color: #2c3e50; color: #ffffff; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        tbody tr:nth-child(even) { background-color: #f8f9fa; }
        tbody tr:hover { background-color: #f1f5f9; }
    </style></head><body>`;
    html += `<div class="header">`;
    html += `<div><h1>Relatório Consolidado de Iniciativas</h1></div>`;
    html += `<div><p>Gerado em: ${new Date().toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'})}</p><p>Total de Registros: ${data.length}</p><p style="color:var(--accent); margin-top:4px;">Filtros: ${scope === 'all' ? 'Nenhum (Base Completa)' : activeText}</p></div>`;
    html += `</div>`;
    html += `<table><thead><tr><th style="width:15%">Eixo</th><th style="width:10%">Estado</th><th style="width:15%">Órgão</th><th style="width:20%">Unidade</th><th style="width:40%">Iniciativa Consolidada</th></tr></thead><tbody>`;
    
    data.forEach(row => {
        html += `<tr><td>${row['Eixo'] || ''}</td><td>${row['Estado'] || ''}</td><td>${row['Órgão'] || ''}</td><td>${row['Unidade'] || ''}</td><td>${row['Iniciativa consolidada'] || ''}</td></tr>`;
    });
    
    html += `</tbody></table></body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// ==========================================
// MODAL CONTROL & EVENTS
// ==========================================
const modalExport = document.getElementById('modal-export');
const btnOpenModal = document.getElementById('btn-open-export-modal');
const btnCloseModal = document.getElementById('btn-close-modal');

if (btnOpenModal) btnOpenModal.addEventListener('click', () => {
    modalExport.style.display = 'flex';
    let active = Object.entries(GlobalState.filters).filter(([k,v]) => v !== null).map(([k,v]) => `${k}: ${v}`);
    if (GlobalState.specialFilters.UnidadeGroup) active.push(`Grupo: ${GlobalState.specialFilters.UnidadeGroup}`);
    for (let k in GlobalState.tableFilters) {
        if (GlobalState.tableFilters[k]) active.push(`Tabela [${k}]: ${GlobalState.tableFilters[k]}`);
    }
    const search = document.getElementById('table-search').value;
    if (search) active.push(`Busca: ${search}`);
    
    const filterWrapper = document.getElementById('export-filters-wrapper');
    if (active.length > 0) {
        document.getElementById('modal-active-filters-text').textContent = active.join(' | ');
        if (filterWrapper) filterWrapper.style.display = 'block';
        document.querySelector('input[name="export-scope"][value="filtered"]').checked = true;
    } else {
        if (filterWrapper) filterWrapper.style.display = 'none';
        document.querySelector('input[name="export-scope"][value="all"]').checked = true;
    }
});
if (btnCloseModal) btnCloseModal.addEventListener('click', () => modalExport.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modalExport) modalExport.style.display = 'none'; });

document.getElementById('btn-export-xlsx').addEventListener('click', () => { exportToExcel(); modalExport.style.display = 'none'; });
document.getElementById('btn-export-pdf').addEventListener('click', () => { exportToPDF(); modalExport.style.display = 'none'; });

document.getElementById('btn-page-prev').addEventListener('click', () => { if (GlobalState.pagination.currentPage > 1) { GlobalState.pagination.currentPage--; renderTable(); } });
document.getElementById('btn-page-next').addEventListener('click', () => { 
    const fullData = GlobalState.getTableFilteredData(GlobalState.getFilteredData());
    if (GlobalState.pagination.currentPage < Math.ceil(fullData.length / GlobalState.pagination.pageSize)) { GlobalState.pagination.currentPage++; renderTable(); } 
});

document.querySelectorAll('.col-filter').forEach(input => input.addEventListener('input', (e) => GlobalState.setTableFilter(e.target.dataset.col, e.target.value)));
document.getElementById('table-search').addEventListener('input', () => renderTable());

btnClearFilters.addEventListener('click', () => {
    GlobalState.specialFilters.UnidadeGroup = null;
    document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
    GlobalState.clearGlobalFilters();
});


document.querySelectorAll('.quick-btn').forEach(btn => btn.addEventListener('click', () => {
    const group = btn.dataset.filterUnit;
    if (GlobalState.specialFilters.UnidadeGroup === group) {
        GlobalState.specialFilters.UnidadeGroup = null;
        btn.classList.remove('active');
    } else {
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        GlobalState.specialFilters.UnidadeGroup = group;
        btn.classList.add('active');
    }
    GlobalState.updateUI(); // Adicionado para atualizar sidebar imediatamente
    processAndRender();
}));



themeBtns.forEach(btn => btn.addEventListener('click', () => { htmlEl.setAttribute('data-theme', btn.dataset.themeVal); updateAllChartsColors(); if (mapChart) updateMapColors(); }));
navBtns.forEach(btn => btn.addEventListener('click', () => {
    if (btn.classList.contains('clear-btn')) return;
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(btn.dataset.target).classList.add('active');
    
    // Pequeno delay para garantir que a aba está visível antes de redimensionar
    setTimeout(() => {
        Object.values(charts).forEach(c => c.resize());
        if (mapChart) mapChart.resize();
        if (wordCloudChart) wordCloudChart.resize();
        lucide.createIcons();
    }, 100);
}));

document.getElementById('btn-reset-colors').addEventListener('click', () => {
    GlobalState.customColors = {};
    initLegend();
    updateAllChartsColors();
    processAndRender();
});

function countBy(dataArray, prop) {
    const counts = {};
    dataArray.forEach(row => { let val = row[prop] || "Não Informado"; counts[val] = (counts[val] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// Start
loadData();

