<script>
    import { onMount, onDestroy } from 'svelte';
    import { 
        BASE_URL,
        REMOTE_API_HOST,
        UNIVERSE_COINS,
        fetchAnalysis,
        fetchScanCandidates, 
        fetchBinanceLivePrice,
        fetchBinanceUniverse24hTickers,
        fetchUniverseRadar,
        translateTrend,
        translateStructureBreak,
        translateLocation,
        translateEffort,
        translateCyclePhase,
        translateCycleStage,
        translateLegOrdinal,
        translateStrength,
        translateCycleReason,
        translateCycleValidity,
        translateCycleProgress,
        translateSequencePattern,
        getFriendlyVPAStatus,
        translateDecisionStatus,
        formatDecisionExplanation,
        translateAction,
        getFriendlyWyckoffTitle, 
        getFriendlyVPADesc,
        cleanSymbol,
        formatPrice,
        formatVNTime 
    } from '../api.js';
    import PriceLocationGauge from './PriceLocationGauge.svelte';

    export let onOpenOrderModal = (symbol, direction, entry, sl, tp) => {};

    // Navigation state: 'radar' (default) | 'single'
    let activeView = 'radar';

    // Radar Market Matrix state
    let radarData = [];
    let isRadarLoading = false;
    let radarTickers = {};
    let radarFilter = 'ALL'; // 'ALL' | 'MARKUP' | 'ACCUMULATION' | 'DISTRIBUTION' | 'MARKDOWN' | 'ACTIONABLE'
    let radarTickerTimer = null;

    // Single Analysis state (Default to BTCUSDT)
    let selectedSymbol = 'BTCUSDT';
    let singleAnalysisData = null;
    let isSingleLoading = false;
    let singleError = null;

    // Realtime Binance Live Price state
    let livePrice = null;
    let livePriceTimer = null;
    let livePriceError = false;
    let priceFlash = null;

    async function loadRadarData() {
        isRadarLoading = true;
        try {
            const analysesPromise = fetchUniverseRadar('4h', 1000).then(analyses => {
                radarData = analyses;
                isRadarLoading = false;
            });

            const tickersPromise = fetchBinanceUniverse24hTickers().then(tickers => {
                if (tickers.ok && tickers.data) {
                    radarTickers = { ...radarTickers, ...tickers.data };
                }
            });

            await Promise.allSettled([analysesPromise, tickersPromise]);
        } catch (e) {
            console.error("Failed to load radar data", e);
        } finally {
            isRadarLoading = false;
        }
    }

    async function updateLivePrice() {
        if (!selectedSymbol) return;
        const res = await fetchBinanceLivePrice(selectedSymbol);
        if (res.ok && res.price !== null) {
            if (livePrice !== null && Math.abs(res.price - livePrice) > 0.000001) {
                priceFlash = res.price > livePrice ? 'flash-up' : 'flash-down';
                setTimeout(() => { priceFlash = null; }, 400);
            }
            livePrice = res.price;
            livePriceError = false;
        } else {
            livePriceError = true;
        }
    }

    function stopRadarTickerPolling() {
        if (radarTickerTimer) {
            clearInterval(radarTickerTimer);
            radarTickerTimer = null;
        }
    }

    function stopLivePricePolling() {
        if (livePriceTimer) {
            clearInterval(livePriceTimer);
            livePriceTimer = null;
        }
    }

    function startRadarTickerPolling() {
        stopRadarTickerPolling();
        radarTickerTimer = setInterval(async () => {
            if (activeView !== 'radar') return;
            const t = await fetchBinanceUniverse24hTickers();
            if (t.ok && t.data) {
                radarTickers = { ...radarTickers, ...t.data };
            }
        }, 4000);
    }

    function startLivePricePolling(sym) {
        stopLivePricePolling();
        livePrice = null;
        updateLivePrice();
        livePriceTimer = setInterval(updateLivePrice, 2500);
    }

    async function loadSingleAnalysis(sym = selectedSymbol) {
        selectedSymbol = sym;
        isSingleLoading = true;
        singleError = null;
        stopRadarTickerPolling();
        startLivePricePolling(sym);
        const res = await fetchAnalysis(sym);
        if (res.success && res.data) {
            singleAnalysisData = res.data;
        } else {
            singleError = res.error || 'Không thể tải dữ liệu phân tích từ API';
        }
        isSingleLoading = false;
    }

    function selectSymbol(sym) {
        selectedSymbol = sym;
        activeView = 'single';
        stopRadarTickerPolling();
        const cached = radarData.find(item => item.symbol === sym);
        if (cached && cached.analysis) {
            singleAnalysisData = cached.analysis;
            isSingleLoading = false;
        }
        loadSingleAnalysis(sym);
    }

    $: phaseCounts = radarData.reduce((acc, item) => {
        if (!item.analysis) return acc;
        const phase = (item.analysis.market_state?.cycle_phase?.phase || 'UNRESOLVED').toUpperCase();
        acc[phase] = (acc[phase] || 0) + 1;
        if (item.analysis.action === 'BUY_READY' || item.analysis.action === 'SHORT_READY') {
            acc.ACTIONABLE = (acc.ACTIONABLE || 0) + 1;
        }
        return acc;
    }, { MARKUP: 0, ACCUMULATION: 0, DISTRIBUTION: 0, MARKDOWN: 0, UNRESOLVED: 0, ACTIONABLE: 0 });

    $: filteredRadarList = radarData.filter(item => {
        if (radarFilter === 'ALL') return true;
        if (!item.analysis) return false;
        if (radarFilter === 'ACTIONABLE') {
            return item.analysis.action === 'BUY_READY' || item.analysis.action === 'SHORT_READY';
        }
        const phase = (item.analysis.market_state?.cycle_phase?.phase || 'UNRESOLVED').toUpperCase();
        return phase === radarFilter;
    });

    $: refPriceNum = singleAnalysisData && singleAnalysisData.reference_price ? parseFloat(singleAnalysisData.reference_price) : 0;
    $: currentDisplayPrice = livePrice || refPriceNum;
    $: priceDiff = currentDisplayPrice - refPriceNum;
    $: priceDiffPct = refPriceNum > 0 ? (priceDiff / refPriceNum) * 100 : 0;

    function computeMarketWeather(data) {
        if (!data) return null;
        const cycle = data.market_state?.cycle_phase;
        const typedPhase = (cycle?.phase || 'UNRESOLVED').toUpperCase();
        const stage = cycle?.stage || 'EARLY';
        const strength = cycle?.authority || cycle?.strength || 'PROVISIONAL';
        const validity = cycle?.validity || 'CURRENT';
        const progress = cycle?.progress || 'STABLE';
        const effectiveFrom = cycle?.effective_from || cycle?.effectiveFrom || null;
        const reason = cycle?.reason || '';
        const pattern = cycle?.sequence_pattern || '';

        const stageVi = translateCycleStage(stage) || 'Giai Đoạn Đầu';
        const strengthVi = translateStrength(strength) || 'Chờ Xác Nhận';
        const validityVi = translateCycleValidity(validity);
        const progressVi = translateCycleProgress(progress);
        const reasonVi = translateCycleReason(reason);
        const patternVi = translateSequencePattern(pattern);

        if (typedPhase === 'MARKUP') {
            return {
                phaseId: 'MARKUP',
                phaseBadge: 'ĐẨY GIÁ',
                phaseClass: 'markup',
                weatherTitle: 'Pha 2: Đẩy Giá',
                weatherSummary: `Cấu trúc sóng tăng đẩy giá. Phe Mua kiểm soát đà tăng${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: 'Lực Cầu Hoàn Toàn Kiểm Soát',
                stage, stageVi, strength, strengthVi, validity, validityVi, progress, progressVi, effectiveFrom, reasonVi, patternVi
            };
        }

        if (typedPhase === 'ACCUMULATION') {
            return {
                phaseId: 'ACCUMULATION',
                phaseBadge: 'TÍCH LŨY',
                phaseClass: 'accumulation',
                weatherTitle: 'Pha 1: Tích Lũy',
                weatherSummary: `Smart Money đang hấp thụ cạn kiệt nguồn cung trong vùng Trading Range${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: 'Đang Hấp Thụ Cung Vùng Đáy',
                stage, stageVi, strength, strengthVi, validity, validityVi, progress, progressVi, effectiveFrom, reasonVi, patternVi
            };
        }

        if (typedPhase === 'DISTRIBUTION') {
            return {
                phaseId: 'DISTRIBUTION',
                phaseBadge: 'PHÂN PHỐI',
                phaseClass: 'distribution',
                weatherTitle: 'Pha 3: Phân Phối',
                weatherSummary: `Áp lực xả hàng ngầm của Smart Money ở vùng đỉnh. Rủi ro gãy sóng tăng cao${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: 'Lực Cung Áp Đảo (Xả Ngầm)',
                stage, stageVi, strength, strengthVi, validity, validityVi, progress, progressVi, effectiveFrom, reasonVi, patternVi
            };
        }

        if (typedPhase === 'MARKDOWN') {
            return {
                phaseId: 'MARKDOWN',
                phaseBadge: 'GIẢM GIÁ',
                phaseClass: 'markdown',
                weatherTitle: 'Pha 4: Giảm Giá',
                weatherSummary: `Thị trường đang trong xu hướng giảm mạnh. Phe Bán hoàn toàn làm chủ cuộc chơi${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: 'Lực Xả Bán Tháo Toàn Diện',
                stage, stageVi, strength, strengthVi, validity, validityVi, progress, progressVi, effectiveFrom, reasonVi, patternVi
            };
        }

        return {
            phaseId: 'UNRESOLVED',
            phaseBadge: 'CHƯA RÕ PHA',
            phaseClass: 'unresolved',
            weatherTitle: 'Đang Định Hình Biên Độ',
            weatherSummary: `Giá đang kiểm tra lại các ngưỡng hỗ trợ/kháng cự. Đang chờ dòng tiền xác nhận hướng đi.`,
            pressure: 'Cung Cầu Cân Bằng / Giằng Co',
            stage, stageVi, strength, strengthVi, validity, validityVi, progress, progressVi, effectiveFrom, reasonVi, patternVi
        };
    }

    $: marketWeather = singleAnalysisData ? computeMarketWeather(singleAnalysisData) : null;

    onMount(() => {
        if (activeView === 'radar') {
            loadRadarData();
            startRadarTickerPolling();
        } else if (activeView === 'single') {
            loadSingleAnalysis(selectedSymbol);
        }
    });

    onDestroy(() => {
        stopLivePricePolling();
        stopRadarTickerPolling();
    });
</script>

<!-- =========================================================
     TOP CONTROL BAR: VIEW SWITCHER & WEATHER RADAR FILTERS
     ========================================================= -->
<div class="top-control-bar">
    <div class="view-toggle-group">
        <button 
            class="pill-btn {activeView === 'radar' ? 'active' : ''}" 
            on:click={() => {
                activeView = 'radar';
                stopLivePricePolling();
                if (radarData.length === 0) loadRadarData();
                startRadarTickerPolling();
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="2"/>
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
            </svg>
            <span>Toàn Cảnh (15 Coin)</span>
        </button>
        <button 
            class="pill-btn {activeView === 'single' ? 'active' : ''}" 
            on:click={() => {
                activeView = 'single';
                stopRadarTickerPolling();
                if (!singleAnalysisData) {
                    const cached = radarData.find(item => item.symbol === selectedSymbol);
                    if (cached && cached.analysis) singleAnalysisData = cached.analysis;
                    loadSingleAnalysis(selectedSymbol);
                } else {
                    startLivePricePolling(selectedSymbol);
                }
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Phân Tích ({cleanSymbol(selectedSymbol)})</span>
        </button>
    </div>

    {#if activeView === 'radar'}
        <!-- Climate Filter Pills -->
        <div class="radar-filters-row">
            <button 
                class="pill-btn {radarFilter === 'ALL' ? 'active' : ''}"
                on:click={() => radarFilter = 'ALL'}
            >
                Tất Cả ({radarData.length})
            </button>
            <button 
                class="pill-btn {radarFilter === 'ACCUMULATION' ? 'active' : ''}"
                on:click={() => radarFilter = 'ACCUMULATION'}
            >
                <span class="dot-indicator dot-accum"></span>
                Tích Lũy ({phaseCounts.ACCUMULATION})
            </button>
            <button 
                class="pill-btn {radarFilter === 'MARKUP' ? 'active' : ''}"
                on:click={() => radarFilter = 'MARKUP'}
            >
                <span class="dot-indicator dot-markup"></span>
                Đẩy Giá ({phaseCounts.MARKUP})
            </button>
            <button 
                class="pill-btn {radarFilter === 'DISTRIBUTION' ? 'active' : ''}"
                on:click={() => radarFilter = 'DISTRIBUTION'}
            >
                <span class="dot-indicator dot-dist"></span>
                Phân Phối ({phaseCounts.DISTRIBUTION})
            </button>
            <button 
                class="pill-btn {radarFilter === 'MARKDOWN' ? 'active' : ''}"
                on:click={() => radarFilter = 'MARKDOWN'}
            >
                <span class="dot-indicator dot-markd"></span>
                Giảm Giá ({phaseCounts.MARKDOWN})
            </button>
            {#if phaseCounts.ACTIONABLE > 0}
                <button 
                    class="pill-btn {radarFilter === 'ACTIONABLE' ? 'active' : ''}"
                    style="border-color: var(--emerald); color: var(--emerald);"
                    on:click={() => radarFilter = 'ACTIONABLE'}
                >
                    Có Điểm Vào ({phaseCounts.ACTIONABLE})
                </button>
            {/if}
            <button 
                class="pill-btn" 
                on:click={loadRadarData} 
                disabled={isRadarLoading}
                title="Làm mới Radar"
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="{isRadarLoading ? 'spin' : ''}">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
            </button>
        </div>
    {:else if activeView === 'single'}
        <!-- 15-Coin Selector Strip -->
        <div class="coin-selector-strip">
            {#each UNIVERSE_COINS as sym}
                <button 
                    class="coin-pill-btn {selectedSymbol === sym ? 'selected' : ''}"
                    on:click={() => selectSymbol(sym)}
                >
                    {cleanSymbol(sym)}
                </button>
            {/each}
        </div>
    {/if}
</div>

<!-- =========================================================
     RADAR MATRIX VIEW: 15 COIN WEATHER STATIONS (CLEAN & AIRY)
     ========================================================= -->
{#if activeView === 'radar'}
    {#if isRadarLoading && radarData.length === 0}
        <div class="card" style="padding: 4rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.15rem; margin-bottom: 0.5rem; font-weight: 700; color: var(--text-primary);">
                Đang quét Radar Khí Tượng 15 Coin Wyckoff...
            </div>
            <div style="font-size: 0.85rem;">Kết nối trực tiếp API Backend 8081 & Realtime Binance Tickers</div>
        </div>
    {:else}
        <div class="radar-grid">
            {#each filteredRadarList as item (item.symbol)}
                {@const sym = cleanSymbol(item.symbol)}
                {@const analysis = item.analysis}
                {@const ticker = radarTickers[item.symbol]}
                {@const liveP = ticker?.price || (analysis?.reference_price ? parseFloat(analysis.reference_price) : 0)}
                {@const changePct = ticker?.priceChangePercent || 0}
                {@const weather = computeMarketWeather(analysis)}
                {@const act = translateAction(analysis?.action)}
                {@const sup = analysis?.key_levels?.support}
                {@const res = analysis?.key_levels?.resistance}

                <div 
                    class="station-card"
                    role="button"
                    tabindex="0"
                    on:click={() => selectSymbol(item.symbol)}
                    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectSymbol(item.symbol); }}
                >
                    <!-- Header: Symbol + Live Price -->
                    <div class="station-header">
                        <span class="station-symbol">{sym}</span>
                        <div class="station-price-group">
                            <div class="station-price">${formatPrice(liveP)}</div>
                            <div class="station-change {changePct >= 0 ? 'text-emerald' : 'text-rose'}">
                                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    <!-- Weather Phase Badge & Stage -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                        {#if weather}
                            <span class="weather-badge {weather.phaseClass}">
                                {weather.phaseBadge}
                            </span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                                {weather.stageVi || 'Giai Đoạn Đầu'}
                            </span>
                        {/if}
                    </div>

                    <!-- Mini Range Progress -->
                    {#if sup && res && sup.status === 'AVAILABLE' && res.status === 'AVAILABLE'}
                        <div class="mini-range-container">
                            <div class="mini-range-labels">
                                <span>Đáy: ${formatPrice(sup.lower)}</span>
                                <span>Đỉnh: ${formatPrice(res.upper)}</span>
                            </div>
                            <div class="mini-range-track">
                                <div class="mini-range-fill" style="width: {Math.min(100, Math.max(0, ((liveP - sup.lower) / (res.upper - sup.lower)) * 100))}%;"></div>
                            </div>
                        </div>
                    {/if}

                    <!-- Simple Context Line -->
                    <div class="station-vpa-signal">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: var(--text-muted);">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        <span>{weather?.reasonVi || 'Mới chớm hình thành pha'}</span>
                    </div>

                    <!-- Footer Action -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.35rem; border-top: 1px solid var(--border-subtle);">
                        <span class="badge {analysis?.action === 'BUY_READY' ? 'badge-emerald' : analysis?.action === 'SHORT_READY' ? 'badge-rose' : 'badge-neutral'}">
                            {act.text}
                        </span>
                        <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 700;">
                            &rarr;
                        </span>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

<!-- =========================================================
     SINGLE COIN WEATHER STATION COCKPIT (WYCKOFF CORE)
     ========================================================= -->
{:else if activeView === 'single'}
    {#if isSingleLoading}
        <div class="card" style="padding: 4rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.15rem; margin-bottom: 0.5rem; font-weight: 700; color: var(--text-primary);">
                Đang phân tích 1000 nến 4H cho {selectedSymbol}...
            </div>
            <div style="font-size: 0.85rem;">Kết nối trực tiếp API: <code>/api/v1/analysis?symbol={selectedSymbol}</code></div>
        </div>
    {:else if singleError}
        <div class="card" style="padding: 2.5rem; text-align: center; border-color: var(--rose-border); background: var(--rose-bg);">
            <strong style="font-size: 1.05rem; color: var(--rose);">Lỗi kết nối API:</strong>
            <p style="color: var(--text-primary); margin-top: 0.5rem;">{singleError}</p>
            <button class="btn btn-outline" style="margin-top: 1rem;" on:click={() => loadSingleAnalysis(selectedSymbol)}>
                Thử lại
            </button>
        </div>
    {:else if singleAnalysisData}
        {@const act = translateAction(singleAnalysisData.action)}
        {@const vpa = getFriendlyVPAStatus(singleAnalysisData.market_state?.effort_result)}
        
        <div class="cockpit-container">
            <!-- ====================================================
                 1. HERO TOP BANNER: WYCKOFF WEATHER MASTER STATE
                 ==================================================== -->
            {#if marketWeather}
                <div class="card hero-weather-banner {marketWeather.phaseClass}">
                    <div class="hero-left">
                        <div class="hero-badge-row">
                            <span class="weather-badge {marketWeather.phaseClass}">
                                {marketWeather.phaseBadge}
                            </span>
                            <span class="badge badge-neutral">
                                {marketWeather.stageVi || 'Giai Đoạn Đầu'}
                            </span>
                            <span class="badge {marketWeather.strength === 'CONFIRMED' ? 'badge-emerald' : 'badge-amber'}">
                                {marketWeather.strengthVi || 'Chờ Xác Nhận'}
                            </span>
                        </div>

                        <div class="hero-title">
                            {marketWeather.weatherTitle}
                        </div>

                        <div class="hero-narrative">
                            {marketWeather.weatherSummary}
                        </div>
                    </div>

                    <div class="hero-right">
                        <div class="hero-price-block">
                            <div class="hero-price-label">GIÁ THỊ TRƯỜNG</div>
                            <div class="hero-price-val {priceFlash || ''}">
                                ${formatPrice(currentDisplayPrice)}
                            </div>
                            {#if livePrice && Math.abs(priceDiffPct) >= 0.01}
                                <div class="hero-delta {priceDiff >= 0 ? 'text-emerald' : 'text-rose'}">
                                    {priceDiff >= 0 ? '+' : ''}{priceDiffPct.toFixed(2)}% so với nến 4H
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- ====================================================
                 2. BENTO 2-COLUMNS: RANGE GAUGE & VPA TELEMETRY
                 ==================================================== -->
            <div class="cockpit-grid">
                <!-- COL 1: TRADING RANGE VISUALIZER -->
                <div class="card cockpit-col-card">
                    <div class="card-header">
                        <span class="card-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="3" y1="9" x2="21" y2="9"/>
                                <line x1="9" y1="21" x2="9" y2="9"/>
                            </svg>
                            <span>Thước Đo Vùng Giá</span>
                        </span>
                        <span class="badge badge-neutral">Nến 4H</span>
                    </div>

                    <!-- Price Gauge Component -->
                    <PriceLocationGauge 
                        price={currentDisplayPrice} 
                        support={singleAnalysisData.key_levels?.support} 
                        resistance={singleAnalysisData.key_levels?.resistance} 
                    />

                    <!-- Support & Resistance Cards -->
                    <div class="support-res-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
                        <div class="price-box" style="border-color: var(--emerald-border); background: var(--emerald-bg);">
                            <span class="price-label text-emerald">VÙNG HỖ TRỢ</span>
                            {#if singleAnalysisData.key_levels?.support?.status === 'AVAILABLE'}
                                <span class="price-val text-emerald">
                                    ${formatPrice(singleAnalysisData.key_levels.support.lower)} – ${formatPrice(singleAnalysisData.key_levels.support.upper)}
                                </span>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">
                                    Cách: <strong>${formatPrice(singleAnalysisData.key_levels.support.distance)}</strong> ({singleAnalysisData.key_levels.support.distance_percent?.toFixed(1)}%)
                                </span>
                            {:else}
                                <span style="font-size: 0.85rem; color: var(--text-muted);">Đang dò đáy mới</span>
                            {/if}
                        </div>

                        <div class="price-box" style="border-color: var(--rose-border); background: var(--rose-bg);">
                            <span class="price-label text-rose">VÙNG KHÁNG CỰ</span>
                            {#if singleAnalysisData.key_levels?.resistance?.status === 'AVAILABLE'}
                                <span class="price-val text-rose">
                                    ${formatPrice(singleAnalysisData.key_levels.resistance.lower)} – ${formatPrice(singleAnalysisData.key_levels.resistance.upper)}
                                </span>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">
                                    Cách: <strong>${formatPrice(singleAnalysisData.key_levels.resistance.distance)}</strong> ({singleAnalysisData.key_levels.resistance.distance_percent?.toFixed(1)}%)
                                </span>
                            {:else}
                                <span style="font-size: 0.85rem; color: var(--text-muted);">Vùng giá mở tự do</span>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- COL 2: VPA DYNAMICS & ACTION BLUEPRINT -->
                <div class="card cockpit-col-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div class="card-header">
                            <span class="card-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                                </svg>
                                <span>Tín Hiệu VPA & Hành Động</span>
                            </span>
                            <span class="badge {act.class}">{act.text}</span>
                        </div>

                        <!-- 3 Mini Telemetry Cards -->
                        <div class="telemetry-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.85rem;">
                            <div class="price-box">
                                <span class="price-label">Xu Hướng</span>
                                <span class="price-val" style="font-size: 0.85rem;">
                                    {translateTrend(singleAnalysisData.market_state?.trend)}
                                </span>
                            </div>
                            <div class="price-box">
                                <span class="price-label">Cấu Trúc</span>
                                <span class="price-val" style="font-size: 0.85rem;">
                                    {translateStructureBreak(singleAnalysisData.market_state?.structure_break)}
                                </span>
                            </div>
                            <div class="price-box">
                                <span class="price-label">Tín Hiệu VPA</span>
                                <span class="price-val" style="font-size: 0.85rem;" title="{vpa.headline}">
                                    {vpa.headline}
                                </span>
                            </div>
                        </div>

                        <!-- Decision Explanation -->
                        <div style="background: var(--bg-subtle); border: 1px solid var(--border-card); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.85rem;">
                            <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem;">
                                Khuyến Nghị Chiến Lược
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.45;">
                                {formatDecisionExplanation(singleAnalysisData)}
                            </div>
                        </div>
                    </div>

                    <!-- Action / Order Button -->
                    <div>
                        {#if singleAnalysisData.plan}
                            <div style="background: var(--emerald-bg); border: 1px solid var(--emerald-border); border-radius: 8px; padding: 0.75rem 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span class="badge badge-emerald">
                                        KẾ HOẠCH {singleAnalysisData.plan.direction === 'SHORT' ? 'BÁN' : 'MUA'}
                                    </span>
                                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--emerald);">
                                        R:R: {singleAnalysisData.plan.reward_risk?.toFixed(2)} R
                                    </span>
                                </div>
                                <div class="plan-price-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; text-align: center; margin-bottom: 0.6rem;">
                                    <div class="price-box" style="padding: 0.35rem;">
                                        <span class="price-label">Giá Vào</span>
                                        <span class="price-val" style="font-size: 0.825rem;">${formatPrice(singleAnalysisData.plan.entry)}</span>
                                    </div>
                                    <div class="price-box" style="padding: 0.35rem;">
                                        <span class="price-label">Cắt Lỗ</span>
                                        <span class="price-val text-rose" style="font-size: 0.825rem;">${formatPrice(singleAnalysisData.plan.stop)}</span>
                                    </div>
                                    <div class="price-box" style="padding: 0.35rem;">
                                        <span class="price-label">Chốt Lời</span>
                                        <span class="price-val text-emerald" style="font-size: 0.825rem;">${formatPrice(singleAnalysisData.plan.target)}</span>
                                    </div>
                                </div>
                                <button 
                                    class="btn btn-emerald" 
                                    style="width: 100%;"
                                    on:click={() => onOpenOrderModal(
                                        singleAnalysisData.symbol, 
                                        singleAnalysisData.plan.direction || 'LONG',
                                        singleAnalysisData.plan.entry,
                                        singleAnalysisData.plan.stop,
                                        singleAnalysisData.plan.target
                                    )}
                                >
                                    Đặt Lệnh Theo Dõi (${formatPrice(singleAnalysisData.plan.entry)})
                                </button>
                            </div>
                        {:else}
                            <button 
                                class="btn btn-outline" 
                                style="width: 100%;"
                                on:click={() => onOpenOrderModal(
                                    selectedSymbol, 
                                    'LONG',
                                    singleAnalysisData.reference_price,
                                    singleAnalysisData.key_levels?.support?.lower || (singleAnalysisData.reference_price * 0.97).toFixed(4),
                                    singleAnalysisData.key_levels?.resistance?.upper || (singleAnalysisData.reference_price * 1.05).toFixed(4)
                                )}
                            >
                                + Tạo Vị Thế Theo Dõi Cho {cleanSymbol(selectedSymbol)}
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
{/if}

<style>
    .top-control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .view-toggle-group {
        display: flex;
        gap: 0.25rem;
        background: #EBE9E3;
        padding: 0.2rem;
        border-radius: 8px;
        border: 1px solid var(--border-card);
    }
    .radar-filters-row {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
        align-items: center;
    }
    .dot-indicator {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
    }
    .dot-accum { background: var(--phase-accum); }
    .dot-markup { background: var(--phase-markup); }
    .dot-dist { background: var(--phase-dist); }
    .dot-markd { background: var(--phase-markdown); }

    .coin-selector-strip {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
        align-items: center;
    }
    .coin-pill-btn {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        color: var(--text-secondary);
        padding: 0.3rem 0.65rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .coin-pill-btn:hover {
        border-color: var(--border-highlight);
        color: var(--text-primary);
        background: var(--bg-card-hover);
    }
    .coin-pill-btn.selected {
        background: var(--text-primary);
        color: #FFFFFF;
        border-color: var(--text-primary);
        font-weight: 700;
    }

    /* Mini Range Visualizer */
    .mini-range-container {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .mini-range-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.675rem;
        color: var(--text-muted);
        font-family: var(--font-mono);
    }
    .mini-range-track {
        height: 4px;
        background: var(--bg-subtle);
        border-radius: 999px;
        overflow: hidden;
    }
    .mini-range-fill {
        height: 100%;
        background: var(--text-primary);
        border-radius: 999px;
    }

    /* Single Cockpit Styles */
    .cockpit-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }
    .hero-weather-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        border-radius: 12px;
        padding: 1.5rem 1.75rem;
        background: var(--bg-card);
        border: 1px solid var(--border-card);
    }
    .hero-weather-banner.markup { border-color: var(--phase-markup-border); background: var(--phase-markup-bg); }
    .hero-weather-banner.accumulation { border-color: var(--phase-accum-border); background: var(--phase-accum-bg); }
    .hero-weather-banner.distribution { border-color: var(--phase-dist-border); background: var(--phase-dist-bg); }
    .hero-weather-banner.markdown { border-color: var(--phase-markdown-border); background: var(--phase-markdown-bg); }

    .hero-left {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }
    .hero-badge-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .hero-title {
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.02em;
    }
    .hero-narrative {
        font-size: 0.875rem;
        color: var(--text-secondary);
        max-width: 680px;
        line-height: 1.5;
    }
    .hero-right {
        text-align: right;
        flex-shrink: 0;
    }
    .hero-price-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }
    .hero-price-label {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-weight: 700;
        letter-spacing: 0.03em;
    }
    .hero-price-val {
        font-size: 2rem;
        font-weight: 800;
        color: var(--text-primary);
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
    }
    .hero-delta {
        font-size: 0.8rem;
        font-weight: 700;
        font-family: var(--font-mono);
    }

    .cockpit-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
    }
    .cockpit-col-card {
        padding: 1.35rem 1.5rem;
    }

    /* Responsive Mobile Overrides */
    @media (max-width: 900px) {
        .hero-weather-banner {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
            padding: 1.25rem;
        }
        .hero-right {
            text-align: left;
            border-top: 1px solid var(--border-subtle);
            padding-top: 0.75rem;
        }
        .hero-price-block {
            align-items: flex-start;
        }
        .hero-price-val {
            font-size: 1.65rem;
        }
        .cockpit-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
        }
    }

    @media (max-width: 640px) {
        .top-control-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 0.5rem;
        }
        .view-toggle-group {
            width: 100%;
        }
        .view-toggle-group .pill-btn {
            flex: 1;
            justify-content: center;
            padding: 0.4rem 0.5rem;
            font-size: 0.775rem;
        }
        .radar-filters-row {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            flex-wrap: nowrap;
            padding-bottom: 3px;
        }
        .radar-filters-row::-webkit-scrollbar {
            display: none;
        }
        .coin-selector-strip {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            flex-wrap: nowrap;
            padding-bottom: 3px;
        }
        .coin-selector-strip::-webkit-scrollbar {
            display: none;
        }
        .hero-title {
            font-size: 1.15rem;
        }
        .hero-narrative {
            font-size: 0.8rem;
        }
        .cockpit-col-card {
            padding: 1rem;
        }
        .telemetry-grid {
            gap: 0.35rem !important;
        }
        .telemetry-grid .price-box {
            padding: 0.45rem 0.5rem;
        }
        .telemetry-grid .price-val {
            font-size: 0.75rem !important;
        }
        .plan-price-grid {
            gap: 0.3rem !important;
        }
    }

    /* Animation spin */
    .spin {
        animation: spinAnim 1s linear infinite;
    }
    @keyframes spinAnim {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
