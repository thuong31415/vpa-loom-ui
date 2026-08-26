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

    // Navigation state: 'radar' (default) | 'single' | 'scan'
    let activeView = 'radar';

    // Radar Market Matrix state
    let radarData = [];
    let isRadarLoading = false;
    let radarTickers = {};
    let radarFilter = 'ALL'; // 'ALL' | 'MARKUP' | 'ACCUMULATION' | 'DISTRIBUTION' | 'MARKDOWN' | 'ACTIONABLE'
    let radarTickerTimer = null;

    // Single Analysis state
    let selectedSymbol = 'ETHUSDT';
    let singleAnalysisData = null;
    let isSingleLoading = false;
    let singleError = null;

    // Realtime Binance Live Price state
    let livePrice = null;
    let livePriceTimer = null;
    let livePriceError = false;
    let priceFlash = null;

    // Scan state
    let scanData = null;
    let dataSource = 'LOADING';
    let isScanLoading = false;

    async function loadRadarData() {
        isRadarLoading = true;
        try {
            const [analyses, tickers] = await Promise.all([
                fetchUniverseRadar('4h', 720),
                fetchBinanceUniverse24hTickers()
            ]);
            radarData = analyses;
            if (tickers.ok && tickers.data) {
                radarTickers = tickers.data;
            }
        } catch (e) {
            console.error("Failed to load radar data", e);
        }
        isRadarLoading = false;
    }

    async function updateLivePrice() {
        if (!selectedSymbol) return;
        const res = await fetchBinanceLivePrice(selectedSymbol);
        if (res.ok && res.price !== null) {
            if (livePrice !== null && Math.abs(res.price - livePrice) > 0.000001) {
                priceFlash = res.price > livePrice ? 'flash-up' : 'flash-down';
                setTimeout(() => { priceFlash = null; }, 500);
            }
            livePrice = res.price;
            livePriceError = false;
        } else {
            livePriceError = true;
        }
    }

    function startLivePricePolling(sym) {
        if (livePriceTimer) clearInterval(livePriceTimer);
        livePrice = null;
        updateLivePrice();
        livePriceTimer = setInterval(updateLivePrice, 2000);
    }

    async function loadSingleAnalysis(sym = selectedSymbol) {
        selectedSymbol = sym;
        isSingleLoading = true;
        singleError = null;
        startLivePricePolling(sym);
        const res = await fetchAnalysis(sym);
        if (res.success && res.data) {
            singleAnalysisData = res.data;
        } else {
            singleError = res.error || 'Không thể tải dữ liệu phân tích từ API';
        }
        isSingleLoading = false;
    }

    async function loadScanData() {
        isScanLoading = true;
        const res = await fetchScanCandidates();
        scanData = res.data;
        dataSource = res.source;
        isScanLoading = false;
    }

    function selectSymbol(sym) {
        selectedSymbol = sym;
        loadSingleAnalysis(sym);
        activeView = 'single';
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
        const trend = data.market_state?.trend || 'MIXED';
        const structureBreak = data.market_state?.structure_break;
        const location = data.market_state?.location;
        const action = data.action;
        const sup = data.key_levels?.support;
        const res = data.key_levels?.resistance;
        const vpa = data.market_state?.effort_result;
        const rangeState = data.market_state?.range_state || 'ACTIVE';
        
        // Unified canonical cycle_phase object from backend
        const cycle = data.market_state?.cycle_phase;
        const typedPhase = (cycle?.phase || 'UNRESOLVED').toUpperCase();
        const stage = cycle?.stage || 'MID';
        const strength = cycle?.authority || cycle?.strength || 'PROVISIONAL';
        const validity = cycle?.validity || 'CURRENT';
        const progress = cycle?.progress || 'STABLE';
        const effectiveFrom = cycle?.effective_from || cycle?.effectiveFrom || null;
        const reason = cycle?.reason || '';
        const pattern = cycle?.sequence_pattern || '';
        const version = cycle?.version || '2.3.0';

        const stageVi = translateCycleStage(stage);
        const strengthVi = translateStrength(strength);
        const validityVi = translateCycleValidity(validity);
        const progressVi = translateCycleProgress(progress);
        const reasonVi = translateCycleReason(reason);
        const patternVi = translateSequencePattern(pattern);

        // 1. Confirmed Markup (typed cycle_phase.phase === 'MARKUP' or fallback indicators when unresolved)
        if (typedPhase === 'MARKUP' || (typedPhase === 'UNRESOLVED' && (action === 'BUY_READY' || location === 'ABOVE_RESISTANCE' || rangeState === 'BROKEN_UP' || structureBreak === 'UP_BREAK_CONFIRMED'))) {
            return {
                phaseId: 'MARKUP',
                phaseStep: 2,
                phaseName: `Pha 2: Đẩy Giá · ${stageVi}`,
                phaseBadge: 'ĐẨY GIÁ',
                typedPhase: 'MARKUP',
                stage,
                stageVi,
                strength,
                strengthVi,
                validity,
                validityVi,
                progress,
                progressVi,
                effectiveFrom,
                reason,
                reasonVi,
                pattern,
                patternVi,
                version,
                rangeState,
                weatherEmoji: '☀️',
                weatherTitle: `Trời Trong · Xu Hướng Đẩy Giá`,
                weatherClass: 'weather-sunny',
                weatherSummary: `Cấu trúc thị trường tăng đồng thuận${patternVi ? ` (${patternVi})` : ''}. Phe Mua kiểm soát hoàn toàn đà giá, không gian phía trên mở rộng.`,
                pressure: '⚡ Lực Cầu Hoàn Toàn Kiểm Soát'
            };
        }

        // 2. Confirmed Markdown (typed cycle_phase.phase === 'MARKDOWN' or fallback indicators when unresolved)
        if (typedPhase === 'MARKDOWN' || (typedPhase === 'UNRESOLVED' && (action === 'SHORT_READY' || location === 'BELOW_SUPPORT' || rangeState === 'BROKEN_DOWN' || structureBreak === 'DOWN_BREAK_CONFIRMED'))) {
            const isAbsorbing = location === 'BETWEEN_SUPPORT_AND_RESISTANCE' || location === 'AT_SUPPORT' || trend === 'MIXED_BULLISH' || (vpa && vpa.type === 'HIGH_EFFORT_LOW_RESULT');
            return {
                phaseId: 'MARKDOWN',
                phaseStep: 4,
                phaseName: isAbsorbing ? `Pha 4: Hãm Đà Giảm · ${stageVi}` : `Pha 4: Giảm Giá · ${stageVi}`,
                phaseBadge: isAbsorbing ? 'HÃM ĐÀ GIẢM' : 'GIẢM GIÁ',
                typedPhase: 'MARKDOWN',
                stage,
                stageVi,
                strength,
                strengthVi,
                validity,
                validityVi,
                progress,
                progressVi,
                effectiveFrom,
                reason,
                reasonVi,
                pattern,
                patternVi,
                version,
                rangeState,
                isAbsorbing,
                weatherEmoji: isAbsorbing ? '⛅' : '⛈️',
                weatherTitle: isAbsorbing ? `Mây Mù Tan Dần · Dò Đáy Hấp Thụ Cung` : `Mưa Giông · Xu Hướng Giảm Giá`,
                weatherClass: isAbsorbing ? 'weather-warning' : 'weather-storm',
                weatherSummary: isAbsorbing
                    ? `Xu hướng giảm vĩ mô đang chững lại trong vùng biên hỗ trợ${patternVi ? ` (${patternVi})` : ''}. Lực cầu cá mập đang hấp thụ cung tạo đáy cân bằng.`
                    : `Cấu trúc thị trường suy thoái${patternVi ? ` (${patternVi})` : ''}. Cản hỗ trợ bị phá vỡ, phe Bán hoàn toàn áp đảo thị trường.`,
                pressure: isAbsorbing ? '⛅ Cung Vĩ Mô Đang Bị Hấp Thụ Tại Hỗ Trợ' : '⛈️ Lực Cung Hoàn Toàn Áp Đảo'
            };
        }

        // 3. Accumulation Sequence (cycle_phase.phase === 'ACCUMULATION')
        if (typedPhase === 'ACCUMULATION') {
            return {
                phaseId: 'ACCUMULATION',
                phaseStep: 1,
                phaseName: `Pha 1: Tích Lũy · ${stageVi}`,
                phaseBadge: 'TÍCH LŨY',
                typedPhase: 'ACCUMULATION',
                stage,
                stageVi,
                strength,
                strengthVi,
                validity,
                validityVi,
                progress,
                progressVi,
                effectiveFrom,
                reason,
                reasonVi,
                pattern,
                patternVi,
                version,
                rangeState,
                weatherEmoji: '🌊',
                weatherTitle: `Sóng Êm · Vùng Tích Lũy Gom Hàng`,
                weatherClass: 'weather-calm',
                weatherSummary: `Thị trường đang trong pha Tích Lũy${patternVi ? ` · Mô hình ${patternVi}` : ''}${reasonVi ? ` · ${reasonVi}` : ''}. Lực cung đáy đang được hấp thụ.`,
                pressure: strength === 'CONFIRMED' ? '🌊 Hấp Thụ Cung Đáy Hoàn Tất' : '🌊 Đang Hấp Thụ Cung Đáy'
            };
        }

        // 4. Distribution Sequence (cycle_phase.phase === 'DISTRIBUTION')
        if (typedPhase === 'DISTRIBUTION') {
            return {
                phaseId: 'DISTRIBUTION',
                phaseStep: 3,
                phaseName: `Pha 3: Phân Phối · ${stageVi}`,
                phaseBadge: 'PHÂN PHỐI',
                typedPhase: 'DISTRIBUTION',
                stage,
                stageVi,
                strength,
                strengthVi,
                validity,
                validityVi,
                progress,
                progressVi,
                effectiveFrom,
                reason,
                reasonVi,
                pattern,
                patternVi,
                version,
                rangeState,
                weatherEmoji: '⚠️',
                weatherTitle: `Cảnh Báo Giông · Vùng Phân Phối Đỉnh`,
                weatherClass: 'weather-warning',
                weatherSummary: `Thị trường đang trong pha Phân Phối${patternVi ? ` · Mô hình ${patternVi}` : ''}${reasonVi ? ` · ${reasonVi}` : ''}. Áp lực bán xả hàng vùng đỉnh.`,
                pressure: strength === 'CONFIRMED' ? '⚠️ Cung Xả Đỉnh Xác Nhận' : '⚠️ Áp Lực Cung Xả Đỉnh'
            };
        }

        // 5. UNRESOLVED / ACTIVE RANGE
        const resDist = res && res.distance_percent !== null && res.distance_percent !== undefined ? parseFloat(res.distance_percent) : 999;
        const supDist = sup && sup.distance_percent !== null && sup.distance_percent !== undefined ? parseFloat(sup.distance_percent) : 999;
        const isAtResistance = location === 'AT_RESISTANCE' || resDist <= 2.5;
        const isAtSupport = location === 'AT_SUPPORT' || supDist <= 2.5;
        const isHeavyVol = vpa && vpa.relative_volume >= 1.8;

        return {
            phaseId: 'UNRESOLVED_RANGE',
            phaseStep: isAtResistance ? 3 : isAtSupport ? 1 : 0,
            phaseName: `Range: ${rangeState} · Pha: Chưa Chốt`,
            phaseBadge: 'CHƯA CHỐT PHA',
            typedPhase: 'UNRESOLVED',
            stage,
            stageVi,
            strength,
            strengthVi,
            validity,
            validityVi,
            progress,
            progressVi,
            effectiveFrom,
            reason,
            reasonVi,
            pattern,
            patternVi,
            version,
            rangeState,
            weatherEmoji: isAtResistance ? '⚠️' : isAtSupport ? '🌊' : '🌫️',
            weatherTitle: isAtResistance
                ? `Áp Lực Vùng Cản · ${isHeavyVol ? `Nỗ Lực Lớn (${vpa.relative_volume}x Vol)` : 'Đang Kiểm Thử Kháng Cự'}`
                : isAtSupport
                ? 'Kiểm Tra Hỗ Trợ Đáy · Hấp Thụ Cung'
                : 'Dao Động Lưng Chừng Range · Tích Lũy Biên Độ',
            weatherClass: isAtResistance ? 'weather-warning' : 'weather-calm',
            weatherSummary: `Đang trong Trading Range hoạt động. ${isAtResistance ? 'Giá đang kiểm tra mép Kháng Cự phía trên.' : isAtSupport ? 'Giá đang kiểm tra mép Hỗ Trợ đáy.' : 'Giá dao động ở vùng trung tính giữa 2 cản.'} Chưa chốt chuỗi Phase hoàn chỉnh.`,
            pressure: isAtResistance
                ? (isHeavyVol ? `⚡ Cung Chặn Lớn (${vpa.relative_volume}x Vol)` : '⚠️ Đang Kiểm Thử Cung Đỉnh')
                : isAtSupport
                ? '🌊 Hấp Thụ Cung Tại Hỗ Trợ'
                : '⚖️ Cân Bằng Cung – Cầu Trong Range'
        };
    }

    $: marketWeather = computeMarketWeather(singleAnalysisData);

    onMount(() => {
        loadRadarData();
        loadSingleAnalysis('ETHUSDT');
        radarTickerTimer = setInterval(async () => {
            const t = await fetchBinanceUniverse24hTickers();
            if (t.ok && t.data) {
                radarTickers = { ...radarTickers, ...t.data };
            }
        }, 3000);
    });

    onDestroy(() => {
        if (livePriceTimer) clearInterval(livePriceTimer);
        if (radarTickerTimer) clearInterval(radarTickerTimer);
    });
</script>

<!-- Top Control Strip (View Selector + Coin Quick Pills) -->
<div class="top-control-bar">
    <div class="view-toggle-group">
        <button 
            class="pill-btn {activeView === 'radar' ? 'active' : ''}" 
            on:click={() => { activeView = 'radar'; if (radarData.length === 0) loadRadarData(); }}
        >
            🌐 Toàn Cảnh (15 Coin)
        </button>
        <button 
            class="pill-btn {activeView === 'single' ? 'active' : ''}" 
            on:click={() => activeView = 'single'}
        >
            🔍 Phân Tích ({cleanSymbol(selectedSymbol)})
        </button>
        <button 
            class="pill-btn {activeView === 'scan' ? 'active' : ''}" 
            on:click={() => { activeView = 'scan'; if (!scanData) loadScanData(); }}
        >
            🎯 Setup Sẵn Sàng {scanData ? `(${scanData.actionable_count})` : ''}
        </button>
    </div>

    {#if activeView === 'single'}
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

{#if activeView === 'radar'}
    <!-- ======================================================== -->
    <!-- RADAR VIEW: TOÀN CẢNH KHÍ TƯỢNG 15 COIN WYCKOFF V2        -->
    <!-- ======================================================== -->
    <div class="radar-container">
        <!-- Sleek Single-Row Filter Toolbar -->
        <div class="radar-toolbar">
            <div class="radar-filters-row">
                <button 
                    class="filter-pill {radarFilter === 'ALL' ? 'active' : ''}"
                    on:click={() => radarFilter = 'ALL'}
                >
                    Tất Cả ({radarData.length})
                </button>
                <button 
                    class="filter-pill pill-markup {radarFilter === 'MARKUP' ? 'active' : ''}"
                    on:click={() => radarFilter = 'MARKUP'}
                >
                    ☀️ Đẩy Giá ({phaseCounts.MARKUP})
                </button>
                <button 
                    class="filter-pill pill-accum {radarFilter === 'ACCUMULATION' ? 'active' : ''}"
                    on:click={() => radarFilter = 'ACCUMULATION'}
                >
                    🌊 Tích Lũy ({phaseCounts.ACCUMULATION})
                </button>
                <button 
                    class="filter-pill pill-dist {radarFilter === 'DISTRIBUTION' ? 'active' : ''}"
                    on:click={() => radarFilter = 'DISTRIBUTION'}
                >
                    ⚠️ Phân Phối ({phaseCounts.DISTRIBUTION})
                </button>
                <button 
                    class="filter-pill pill-markd {radarFilter === 'MARKDOWN' ? 'active' : ''}"
                    on:click={() => radarFilter = 'MARKDOWN'}
                >
                    ⛈️ Giảm Giá ({phaseCounts.MARKDOWN})
                </button>
                {#if phaseCounts.ACTIONABLE > 0}
                    <button 
                        class="filter-pill pill-actionable {radarFilter === 'ACTIONABLE' ? 'active' : ''}"
                        on:click={() => radarFilter = 'ACTIONABLE'}
                    >
                        🟢 Có Setup ({phaseCounts.ACTIONABLE})
                    </button>
                {/if}
            </div>

            <button 
                class="btn btn-outline" 
                style="padding: 0.35rem 0.75rem; font-size: 0.775rem;"
                on:click={loadRadarData} 
                disabled={isRadarLoading}
            >
                {isRadarLoading ? '⌛' : '🔄'} Làm Mới
            </button>
        </div>

        {#if isRadarLoading && radarData.length === 0}
            <div class="card" style="padding: 4rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.25rem; margin-bottom: 0.5rem; font-weight: 600;">⌛ Đang nạp radar khí tượng 15 đồng coin...</div>
                <div style="font-size: 0.85rem;">Phân tích song song mô hình Wyckoff V2 & kết nối giá Binance Realtime</div>
            </div>
        {:else}
            <!-- 15-Coin Matrix Grid -->
            <div class="radar-matrix-grid">
                {#each filteredRadarList as item (item.symbol)}
                    {@const sym = cleanSymbol(item.symbol)}
                    {@const analysis = item.analysis}
                    {@const ticker = radarTickers[item.symbol]}
                    {@const liveP = ticker?.price || (analysis?.reference_price ? parseFloat(analysis.reference_price) : 0)}
                    {@const changePct = ticker?.priceChangePercent || 0}
                    {@const weather = computeMarketWeather(analysis)}
                    {@const act = translateAction(analysis?.action)}
                    {@const supDistPct = analysis?.key_levels?.support?.distance_percent}
                    {@const resDistPct = analysis?.key_levels?.resistance?.distance_percent}

                    <div 
                        class="card radar-tile {weather ? weather.weatherClass : ''} {analysis?.action === 'BUY_READY' || analysis?.action === 'SHORT_READY' ? 'tile-actionable' : ''}"
                        role="button"
                        tabindex="0"
                        on:click={() => selectSymbol(item.symbol)}
                        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectSymbol(item.symbol); }}
                    >
                        <!-- Tile Header -->
                        <div class="tile-header">
                            <div class="tile-symbol-group">
                                <span class="tile-symbol-tag">{sym}</span>
                                <div class="tile-price-group">
                                    <span class="tile-price">${formatPrice(liveP)}</span>
                                    {#if ticker}
                                        <span class="tile-change {changePct >= 0 ? 'up' : 'down'}">
                                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                                        </span>
                                    {/if}
                                </div>
                            </div>
                            
                            {#if weather}
                                <span class="tile-phase-badge {weather.weatherClass}">
                                    {weather.weatherEmoji} {weather.phaseBadge}
                                </span>
                            {/if}
                        </div>

                        <!-- Tile Wyckoff Stage & Progress Row -->
                        {#if weather}
                            <div class="tile-meta-row">
                                <span class="tile-subtext">
                                    {weather.stageVi || 'Giai đoạn giữa'} · {weather.strengthVi || 'Xác nhận'}
                                </span>
                                {#if weather.progressVi}
                                    <span class="tile-progress-text">{weather.progressVi}</span>
                                {/if}
                            </div>
                        {/if}

                        <!-- Tile Mini Range Bar -->
                        <div class="tile-range-box">
                            <div class="tile-range-labels">
                                <span class="range-lbl-sup">
                                    Hỗ trợ: {supDistPct !== null && supDistPct !== undefined ? `${Math.abs(supDistPct).toFixed(1)}%` : 'Đang dò đáy'}
                                </span>
                                <span class="range-lbl-res">
                                    Kháng cự: {resDistPct !== null && resDistPct !== undefined ? `${Math.abs(resDistPct).toFixed(1)}%` : 'Open Air'}
                                </span>
                            </div>
                            <div class="tile-range-track">
                                <div 
                                    class="tile-range-fill {weather ? weather.weatherClass : ''}" 
                                    style="width: {supDistPct !== null && resDistPct !== null && (Math.abs(supDistPct) + Math.abs(resDistPct)) > 0 ? Math.min(100, Math.max(10, (Math.abs(supDistPct) / (Math.abs(supDistPct) + Math.abs(resDistPct))) * 100)) : 50}%;"
                                ></div>
                            </div>
                        </div>

                        <!-- Tile Action Footer -->
                        <div class="tile-footer">
                            <span class="status-pill {act.class}" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;">
                                <span class="dot"></span>
                                {act.text}
                            </span>
                            <span class="tile-view-link">Chi tiết ➔</span>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

{:else if activeView === 'single'}
    <!-- ======================================================== -->
    <!-- AIRY & SPACIOUS 2-COLUMN COCKPIT VIEW                     -->
    <!-- ======================================================== -->
    {#if isSingleLoading}
        <div class="card" style="padding: 3.5rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⌛ Đang phân tích dữ liệu 720 nến 4H cho {selectedSymbol}...</div>
            <div style="font-size: 0.85rem;">Kết nối trực tiếp tới <code>/api/v1/analysis?symbol={selectedSymbol}</code></div>
        </div>
    {:else if singleError}
        <div class="card" style="padding: 2.5rem; text-align: center; color: var(--rose); background: var(--rose-bg); border-color: var(--rose-border);">
            <strong style="font-size: 1.05rem;">⚠️ Không thể tải dữ liệu:</strong> {singleError}
            <div style="margin-top: 1rem;">
                <button class="btn btn-outline" on:click={() => loadSingleAnalysis(selectedSymbol)}>🔄 Thử lại</button>
            </div>
        </div>
    {:else if singleAnalysisData}
        {@const act = translateAction(singleAnalysisData.action)}
        {@const vpa = getFriendlyVPAStatus(singleAnalysisData.market_state?.effort_result)}
        <div class="cockpit-grid">
            <!-- ==================================================== -->
            <!-- LEFT COLUMN: CON TÀU THỊ TRƯỜNG & VỊ TRÍ 2 CẢN      -->
            <!-- ==================================================== -->
            <div class="card cockpit-card">
                <!-- Header Info -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span class="symbol-tag" style="font-size: 0.8rem; padding: 0.2rem 0.55rem;">{cleanSymbol(selectedSymbol)}</span>
                        <span class="status-pill {act.class}" style="font-size: 0.725rem; padding: 0.15rem 0.5rem;">
                            <span class="dot"></span>
                            {act.text}
                        </span>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-variant-numeric: tabular-nums;">
                        {singleAnalysisData.as_of ? formatVNTime(singleAnalysisData.as_of) : '4H'}
                    </span>
                </div>

                <!-- Price Headline (Polished & Binance Live Integrated) -->
                <div class="price-headline-card">
                    <div class="price-primary-row">
                        <div class="price-live-display">
                            <span class="currency-symbol">$</span>
                            <span class="price-digits {priceFlash || ''}">{formatPrice(currentDisplayPrice)}</span>
                        </div>
                        {#if livePrice}
                            <div class="live-pill" title="Giá thời gian thực khớp lệnh trực tiếp từ Binance">
                                <span class="pulse-beacon"></span>
                                <span class="live-text">LIVE</span>
                            </div>
                        {/if}
                    </div>

                    <div class="price-sub-row">
                        <div class="ref-badge" title="Giá đóng nến 4H gần nhất dùng làm căn cứ thuật toán VPA">
                            <span class="ref-title">Tham chiếu 4H:</span>
                            <span class="ref-val">${formatPrice(refPriceNum)}</span>
                        </div>
                        {#if livePrice && Math.abs(priceDiffPct) >= 0.01}
                            <span class="delta-badge {priceDiff >= 0 ? 'up' : 'down'}" title="Độ lệch giữa giá realtime và giá đóng nến 4H">
                                {priceDiff >= 0 ? '▲ +' : '▼ '}{priceDiffPct.toFixed(2)}%
                            </span>
                        {/if}
                    </div>
                </div>

                <!-- Price Location Visual Gauge (Con Tàu Thị Trường với giá Realtime) -->
                <PriceLocationGauge 
                    price={currentDisplayPrice} 
                    support={singleAnalysisData.key_levels?.support} 
                    resistance={singleAnalysisData.key_levels?.resistance} 
                />

                <!-- 2 Hộp Cản Hỗ Trợ & Kháng Cự (Side-by-Side) -->
                <div class="meta-grid" style="margin-top: 0.65rem; gap: 0.65rem;">
                    <!-- Support -->
                    <div class="price-box" style="background: var(--emerald-bg); border-color: var(--emerald-border); padding: 0.65rem 0.85rem;">
                        <span class="price-label" style="color: var(--emerald); font-weight: 700; font-size: 0.725rem; text-transform: uppercase;">HỖ TRỢ</span>
                        {#if singleAnalysisData.key_levels?.support?.status === 'AVAILABLE'}
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--emerald); margin: 0.2rem 0; white-space: nowrap; font-variant-numeric: tabular-nums;">
                                ${formatPrice(singleAnalysisData.key_levels.support.lower)} – ${formatPrice(singleAnalysisData.key_levels.support.upper)}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--emerald);">
                                Cách: <strong>${Math.abs(parseFloat(singleAnalysisData.key_levels.support.distance || 0)) < 0.0001 ? '0.00' : formatPrice(singleAnalysisData.key_levels.support.distance)}</strong> ({singleAnalysisData.key_levels.support.distance_percent?.toFixed(1)}%)
                            </div>
                        {:else}
                            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-top: 0.2rem;">
                                Đang dò đáy mới
                            </div>
                        {/if}
                    </div>

                    <!-- Resistance -->
                    <div class="price-box" style="background: var(--rose-bg); border-color: var(--rose-border); padding: 0.65rem 0.85rem;">
                        <span class="price-label" style="color: var(--rose); font-weight: 700; font-size: 0.725rem; text-transform: uppercase;">KHÁNG CỰ</span>
                        {#if singleAnalysisData.key_levels?.resistance?.status === 'AVAILABLE'}
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--rose); margin: 0.2rem 0; white-space: nowrap; font-variant-numeric: tabular-nums;">
                                ${formatPrice(singleAnalysisData.key_levels.resistance.lower)} – ${formatPrice(singleAnalysisData.key_levels.resistance.upper)}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--rose);">
                                Cách: <strong>${Math.abs(parseFloat(singleAnalysisData.key_levels.resistance.distance || 0)) < 0.0001 ? '0.00' : formatPrice(singleAnalysisData.key_levels.resistance.distance)}</strong> ({singleAnalysisData.key_levels.resistance.distance_percent?.toFixed(1)}%)
                            </div>
                        {:else}
                            <div style="font-size: 0.85rem; font-weight: 600; color: var(--rose); margin-top: 0.2rem;">
                                Không gian mở (Open Air)
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- ==================================================== -->
            <!-- RIGHT COLUMN: ĐỘNG LỰC, VPA & QUYẾT ĐỊNH THUẬT TOÁN   -->
            <!-- ==================================================== -->
            <div class="card cockpit-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <!-- 3 Cột Trạng Thái Thị Trường (Gọn gàng, không trùng lặp Vị trí cản với cột trái) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
                            Động Lực VPA & Kế Hoạch Giao Dịch
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div class="price-box" style="padding: 0.45rem 0.65rem;">
                            <span class="price-label" style="font-size: 0.675rem;">Xu Hướng Bias</span>
                            <span class="price-val" style="font-size: 0.825rem; font-weight: 700;">
                                {translateTrend(singleAnalysisData.market_state?.trend)}
                            </span>
                        </div>
                        <div class="price-box" style="padding: 0.45rem 0.65rem;">
                            <span class="price-label" style="font-size: 0.675rem;">Cấu Trúc Nến</span>
                            <span class="price-val" style="font-size: 0.825rem; font-weight: 700;">
                                {translateStructureBreak(singleAnalysisData.market_state?.structure_break)}
                            </span>
                        </div>
                        <div class="price-box" style="padding: 0.45rem 0.65rem;">
                            <span class="price-label" style="font-size: 0.675rem;">Động Lực VPA</span>
                            <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="{vpa.headline}">
                                {vpa.headline}
                            </div>
                        </div>
                    </div>

                    <!-- Algorithmic Decision Box -->
                    <div style="background: var(--bg-subtle); border: 1px solid var(--border-card); border-radius: 10px; padding: 0.55rem 0.85rem; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                            <span style="font-size: 0.725rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                                Quyết Định Thuật Toán
                            </span>
                            <span class="badge badge-neutral" style="font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.45rem;">
                                {translateDecisionStatus(singleAnalysisData.decision?.status)}
                            </span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
                            {formatDecisionExplanation(singleAnalysisData)}
                        </div>
                    </div>
                </div>

                <!-- Plan or Manual Position Action -->
                <div>
                    {#if singleAnalysisData.plan}
                        <div style="background: var(--emerald-bg); border: 1px solid var(--emerald-border); border-radius: 10px; padding: 0.55rem 0.85rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                <span class="badge badge-emerald" style="font-weight: 700; font-size: 0.75rem;">
                                    🚀 KẾ HOẠCH {singleAnalysisData.plan.direction}
                                </span>
                                <span style="font-size: 0.75rem; font-weight: 600; color: var(--emerald);">
                                    {getFriendlyWyckoffTitle(singleAnalysisData.plan.policy_id, singleAnalysisData.plan.direction)}
                                </span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; text-align: center; margin-bottom: 0.45rem;">
                                <div style="background: #FFF; padding: 0.3rem; border-radius: 6px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.65rem; color: var(--text-muted);">Entry</div>
                                    <div style="font-size: 0.8rem; font-weight: 700;">${formatPrice(singleAnalysisData.plan.entry)}</div>
                                </div>
                                <div style="background: #FFF; padding: 0.3rem; border-radius: 6px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.65rem; color: var(--text-muted);">Stop Loss</div>
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--rose);">${formatPrice(singleAnalysisData.plan.stop)}</div>
                                </div>
                                <div style="background: #FFF; padding: 0.3rem; border-radius: 6px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.65rem; color: var(--text-muted);">Take Profit</div>
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--emerald);">${formatPrice(singleAnalysisData.plan.target)}</div>
                                </div>
                                <div style="background: #FFF; padding: 0.3rem; border-radius: 6px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.65rem; color: var(--text-muted);">Tỷ Lệ R:R</div>
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--emerald);">{singleAnalysisData.plan.reward_risk?.toFixed(2)} R</div>
                                </div>
                            </div>
                            <button 
                                class="btn btn-emerald" 
                                style="width: 100%; padding: 0.45rem; font-size: 0.8rem; font-weight: 600;"
                                on:click={() => onOpenOrderModal(
                                    singleAnalysisData.symbol, 
                                    singleAnalysisData.plan.direction || 'LONG',
                                    singleAnalysisData.plan.entry,
                                    singleAnalysisData.plan.stop,
                                    singleAnalysisData.plan.target
                                )}
                            >
                                📋 Đặt Lệnh Theo Dõi (${formatPrice(singleAnalysisData.plan.entry)})
                            </button>
                        </div>
                    {:else}
                        <button 
                            class="btn btn-outline" 
                            style="width: 100%; padding: 0.45rem; font-size: 0.8rem; font-weight: 600; border-style: dashed;"
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

        <!-- ==================================================== -->
        <!-- BOTTOM BLOCK: BẢN ĐỒ CHU KỲ & TRẠM KHÍ TƯỢNG VĨ MÔ   -->
        <!-- ==================================================== -->
        {#if marketWeather}
            <div class="card weather-card {marketWeather.weatherClass}">
                <!-- Weather Alert Top Banner -->
                <div class="weather-top-row">
                    <div class="weather-meta">
                        <span class="weather-icon-badge">{marketWeather.weatherEmoji}</span>
                        <div>
                            <div class="weather-status-name">{marketWeather.weatherTitle}</div>
                            <div class="weather-tags-row" style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.35rem;">
                                <span class="weather-phase-tag">{marketWeather.phaseBadge}</span>
                                {#if marketWeather.stageVi}
                                    <span class="weather-phase-tag" style="background: rgba(14, 165, 233, 0.08); border-color: rgba(14, 165, 233, 0.25); color: #0284c7;">
                                        {marketWeather.stageVi}
                                    </span>
                                {/if}
                                {#if marketWeather.strengthVi}
                                    <span class="weather-phase-tag" style="background: {marketWeather.strength === 'CONFIRMED' ? 'var(--emerald-bg)' : 'var(--amber-bg)'}; border-color: {marketWeather.strength === 'CONFIRMED' ? 'var(--emerald-border)' : 'var(--amber-border)'}; color: {marketWeather.strength === 'CONFIRMED' ? 'var(--emerald)' : 'var(--amber)'};">
                                        {marketWeather.strengthVi}
                                    </span>
                                {/if}
                                {#if marketWeather.progressVi}
                                    <span class="weather-phase-tag" style="background: rgba(168, 85, 247, 0.08); border-color: rgba(168, 85, 247, 0.25); color: #9333ea;">
                                        Tiến trình: {marketWeather.progressVi}
                                    </span>
                                {/if}
                                {#if marketWeather.validity && marketWeather.validity !== 'CURRENT'}
                                    <span class="weather-phase-tag" style="background: var(--rose-bg); border-color: var(--rose-border); color: var(--rose); font-weight: 600;">
                                        ⚠️ {marketWeather.validityVi || marketWeather.validity}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <div class="weather-advisory-box">
                        <div class="advisory-label">Áp Suất Cung – Cầu Vĩ Mô:</div>
                        <div class="advisory-text">{marketWeather.pressure}</div>
                        {#if marketWeather.patternVi || marketWeather.reasonVi}
                            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.2rem; line-height: 1.3;">
                                <strong>Đặc tả:</strong> {marketWeather.patternVi ? marketWeather.patternVi : ''}{marketWeather.patternVi && marketWeather.reasonVi ? ' · ' : ''}{marketWeather.reasonVi ? marketWeather.reasonVi : ''}
                            </div>
                        {/if}
                        <div style="font-size: 0.675rem; color: var(--text-muted); margin-top: 0.15rem; font-variant-numeric: tabular-nums; display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
                            <span>Khung Range: ${formatPrice(singleAnalysisData.key_levels?.support?.lower || 0)} ↔ ${formatPrice(singleAnalysisData.key_levels?.resistance?.upper || 0)}</span>
                            {#if marketWeather.effectiveFrom}
                                <span>Pha từ: <strong>{formatVNTime(marketWeather.effectiveFrom)}</strong></span>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- 4-Phase Wyckoff Macro Roadmap Stepper (Expanded & Informative) -->
                <div class="macro-stepper-grid">
                    <!-- Step 1: Accumulation -->
                    <div class="stepper-node {marketWeather.phaseId === 'ACCUMULATION' ? 'node-active' : marketWeather.phaseId === 'UNRESOLVED_RANGE' && marketWeather.phaseStep === 1 ? 'node-testing' : 'node-inactive'}">
                        <div class="node-header">
                            <span class="node-step">PHA 1</span>
                            {#if marketWeather.phaseId === 'ACCUMULATION'}
                                <span class="node-badge-here">● {marketWeather.strength === 'CONFIRMED' ? 'XÁC NHẬN' : 'TẠM THỜI'} · {marketWeather.stageVi || 'TÍCH LŨY'}</span>
                            {:else if marketWeather.phaseId === 'UNRESOLVED_RANGE' && marketWeather.phaseStep === 1}
                                <span class="node-badge-testing">● TIẾP CẬN HỖ TRỢ</span>
                            {/if}
                        </div>
                        <div class="node-title">🧱 Tích Lũy Gom Hàng</div>
                        <div class="node-desc">Giai đoạn A – C: Dò đáy, hấp thụ cạn cung</div>
                        <div class="node-points">
                            {#if marketWeather.phaseId === 'ACCUMULATION' && (marketWeather.patternVi || marketWeather.reasonVi)}
                                <span>• {marketWeather.patternVi || 'Đi ngang trong range'}</span>
                                <span>• {marketWeather.reasonVi || 'Chờ xác nhận test đáy'}</span>
                            {:else}
                                <span>• Đi ngang trong range</span>
                                <span>• Chờ xác nhận test đáy</span>
                            {/if}
                        </div>
                    </div>

                    <div class="stepper-arrow {marketWeather.phaseStep >= 2 ? 'arrow-active' : ''}">➔</div>

                    <!-- Step 2: Markup -->
                    <div class="stepper-node {marketWeather.phaseId === 'MARKUP' ? 'node-active' : 'node-inactive'}">
                        <div class="node-header">
                            <span class="node-step">PHA 2</span>
                            {#if marketWeather.phaseId === 'MARKUP'}
                                <span class="node-badge-here">● {marketWeather.strength === 'CONFIRMED' ? 'XÁC NHẬN' : 'TẠM THỜI'} · {marketWeather.stageVi || 'ĐẨY GIÁ'}</span>
                            {/if}
                        </div>
                        <div class="node-title">🚀 Xu Hướng Đẩy Giá</div>
                        <div class="node-desc">Giai đoạn D – E: Vượt cản, mở rộng sóng</div>
                        <div class="node-points">
                            <span>• Phe Mua kiểm soát</span>
                            <span>• Bầu trời mở rộng đà tăng</span>
                        </div>
                    </div>

                    <div class="stepper-arrow {marketWeather.phaseStep >= 3 ? 'arrow-active' : ''}">➔</div>

                    <!-- Step 3: Distribution -->
                    <div class="stepper-node {marketWeather.phaseId === 'DISTRIBUTION' ? 'node-active' : marketWeather.phaseId === 'UNRESOLVED_RANGE' && marketWeather.phaseStep === 3 ? 'node-testing' : 'node-inactive'}">
                        <div class="node-header">
                            <span class="node-step">PHA 3</span>
                            {#if marketWeather.phaseId === 'DISTRIBUTION'}
                                <span class="node-badge-here">● {marketWeather.strength === 'CONFIRMED' ? 'XÁC NHẬN' : 'TẠM THỜI'} · {marketWeather.stageVi || 'PHÂN PHỐI'}</span>
                            {:else if marketWeather.phaseId === 'UNRESOLVED_RANGE' && marketWeather.phaseStep === 3}
                                <span class="node-badge-testing">● TIẾP CẬN KHÁNG CỰ</span>
                            {/if}
                        </div>
                        <div class="node-title">⚠️ Phân Phối Tạo Đỉnh</div>
                        <div class="node-desc">Giai đoạn A – C: Kiệt sức mua, xả hàng</div>
                        <div class="node-points">
                            {#if marketWeather.phaseId === 'DISTRIBUTION' && (marketWeather.patternVi || marketWeather.reasonVi)}
                                <span>• {marketWeather.patternVi || 'Lực cầu suy yếu đỉnh'}</span>
                                <span>• {marketWeather.reasonVi || 'Bẫy tăng giá'}</span>
                            {:else}
                                <span>• Lực cầu suy yếu đỉnh</span>
                                <span>• Bẫy tăng giá</span>
                            {/if}
                        </div>
                    </div>

                    <div class="stepper-arrow {marketWeather.phaseStep >= 4 ? 'arrow-active' : ''}">➔</div>

                    <!-- Step 4: Markdown -->
                    <div class="stepper-node {marketWeather.phaseId === 'MARKDOWN' ? 'node-active' : 'node-inactive'}">
                        <div class="node-header">
                            <span class="node-step">PHA 4</span>
                            {#if marketWeather.phaseId === 'MARKDOWN'}
                                <span class="node-badge-here">● {marketWeather.strength === 'CONFIRMED' ? 'XÁC NHẬN' : 'TẠM THỜI'} · {marketWeather.phaseBadge}</span>
                            {/if}
                        </div>
                        <div class="node-title">{marketWeather.isAbsorbing ? '⛅ Dò Đáy Hấp Thụ' : '📉 Xu Hướng Giảm Giá'}</div>
                        <div class="node-desc">{marketWeather.isAbsorbing ? 'Giai đoạn A – B: Hãm đà, hấp thụ lực bán đáy' : 'Giai đoạn D – E: Thủng hỗ trợ, giảm sâu'}</div>
                        <div class="node-points">
                            {#if marketWeather.isAbsorbing}
                                <span>• Nén trong biên hỗ trợ</span>
                                <span>• Xuất hiện lực hấp thụ đáy</span>
                            {:else}
                                <span>• Phe Bán áp đảo</span>
                                <span>• Chờ cấu trúc cân bằng mới</span>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    {/if}

{:else if activeView === 'scan'}
    <!-- ======================================================== -->
    <!-- SCAN VIEW ACROSS ALL UNIVERSE COINS                       -->
    <!-- ======================================================== -->
    <div class="card">
        <div class="card-header" style="margin-bottom: 1rem;">
            <div>
                <div class="card-title">Bộ Quét Thị Trường Tự Động ({scanData?.scanned_count || UNIVERSE_COINS.length} Cặp Coin)</div>
                {#if scanData}
                    <div class="stat-sub" style="margin-top: 0.25rem;">
                        📊 Đã quét <strong>{scanData.scanned_count}</strong> coin · 
                        <span class="text-emerald" style="font-weight: 600;">{scanData.actionable_count} Setup sẵn sàng</span> · 
                        {scanData.no_trade_count} Đang quan sát · 
                        {scanData.failures?.length || 0} Lỗi
                    </div>
                {/if}
            </div>
            <button class="btn btn-outline" style="padding: 0.45rem 0.9rem; font-size: 0.85rem;" on:click={loadScanData} disabled={isScanLoading}>
                {isScanLoading ? '⌛ Đang quét...' : '🔍 Quét Lại Danh Mục'}
            </button>
        </div>

        {#if isScanLoading}
            <div style="padding: 3.5rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⌛ Đang chạy quét song song trên backend...</div>
                <div style="font-size: 0.85rem;"><code>GET /api/v1/analysis/scan</code></div>
            </div>
        {:else if scanData && scanData.candidates && scanData.candidates.length > 0}
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1rem;">
                {#each scanData.candidates as candidate}
                    <div class="subtype-card" style="margin-bottom: 0; padding: 1.15rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="symbol-tag" style="font-size: 1rem;">{cleanSymbol(candidate.symbol)}</span>
                                <span class="badge badge-emerald" style="font-size: 0.775rem;">🟢 Sẵn sàng ({candidate.analysis?.plan?.direction || 'LONG'})</span>
                            </div>
                            <span class="badge badge-neutral" style="font-size: 0.75rem;">
                                Điểm: {(candidate.priority?.score || 95).toFixed(1)}/100
                            </span>
                        </div>

                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.3rem;">
                            {getFriendlyWyckoffTitle(candidate.analysis?.plan?.policy_id, candidate.analysis?.plan?.direction)}
                        </div>

                        {#if candidate.analysis?.market_state?.cycle_phase}
                            {@const candCycle = candidate.analysis.market_state.cycle_phase}
                            {@const candPhaseVi = translateCyclePhase(candCycle.phase)}
                            {@const candStageVi = translateCycleStage(candCycle.stage)}
                            {@const candStrengthVi = translateStrength(candCycle.authority || candCycle.strength)}
                            <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.45rem; flex-wrap: wrap;">
                                <span class="weather-phase-tag" style="font-size: 0.7rem; padding: 0.1rem 0.45rem;">
                                    🏛️ {candPhaseVi || 'Chưa chốt pha'} {candStageVi ? `· ${candStageVi}` : ''}
                                </span>
                                {#if candStrengthVi}
                                    <span class="weather-phase-tag" style="font-size: 0.7rem; padding: 0.1rem 0.45rem; background: {candCycle.authority === 'CONFIRMED' || candCycle.strength === 'CONFIRMED' ? 'var(--emerald-bg)' : 'var(--amber-bg)'}; border-color: {candCycle.authority === 'CONFIRMED' || candCycle.strength === 'CONFIRMED' ? 'var(--emerald-border)' : 'var(--amber-border)'}; color: {candCycle.authority === 'CONFIRMED' || candCycle.strength === 'CONFIRMED' ? 'var(--emerald)' : 'var(--amber)'};">
                                        {candStrengthVi}
                                    </span>
                                {/if}
                            </div>
                        {/if}

                        <div style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.75rem;">
                            {getFriendlyVPADesc(candidate)}
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.45rem; text-align: center; margin-bottom: 0.75rem;">
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">Entry</span>
                                <span class="price-val" style="font-size: 0.85rem;">${formatPrice(candidate.analysis?.plan?.entry)}</span>
                            </div>
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">SL</span>
                                <span class="price-val text-rose" style="font-size: 0.85rem;">${formatPrice(candidate.analysis?.plan?.stop)}</span>
                            </div>
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">TP</span>
                                <span class="price-val text-emerald" style="font-size: 0.85rem;">${formatPrice(candidate.analysis?.plan?.target)}</span>
                            </div>
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">R:R</span>
                                <span class="price-val text-emerald" style="font-size: 0.85rem;">{candidate.analysis?.plan?.reward_risk?.toFixed(2)} R</span>
                            </div>
                        </div>

                        <button 
                            class="btn btn-emerald" 
                            style="width: 100%; padding: 0.5rem; font-size: 0.85rem; font-weight: 600;"
                            on:click={() => onOpenOrderModal(
                                candidate.symbol,
                                candidate.analysis?.plan?.direction || 'LONG',
                                candidate.analysis?.plan?.entry,
                                candidate.analysis?.plan?.stop,
                                candidate.analysis?.plan?.target
                            )}
                        >
                            📋 Đặt Lệnh ({candidate.analysis?.plan?.direction} @ ${formatPrice(candidate.analysis?.plan?.entry)})
                        </button>
                    </div>
                {/each}
            </div>
        {:else}
            <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⏸️ Chưa có coin nào đạt chuẩn vào lệnh (NO TRADE)</div>
                <div style="font-size: 0.875rem; max-width: 520px; margin: 0 auto; line-height: 1.55;">
                    Toàn bộ {UNIVERSE_COINS.length} coin đang trong trạng thái quan sát hoặc nằm lưng chừng range. Hệ thống giữ vững kỷ luật, chờ tín hiệu xác nhận cạn cung tại hỗ trợ.
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .top-control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        gap: 0.85rem;
        flex-wrap: wrap;
    }
    .view-toggle-group {
        display: flex;
        gap: 0.4rem;
    }
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
        padding: 0.25rem 0.6rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .coin-pill-btn:hover {
        border-color: var(--text-primary);
        color: var(--text-primary);
    }
    .coin-pill-btn.selected {
        background: var(--btn-primary);
        color: #FFFFFF;
        border-color: var(--btn-primary);
    }
    .cockpit-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        align-items: stretch;
    }
    .cockpit-card {
        margin-bottom: 0;
        padding: 1.15rem 1.35rem;
        border-radius: 14px;
    }
    @media (max-width: 950px) {
        .cockpit-grid {
            grid-template-columns: 1fr;
        }
    }

    /* Price Headline Refinements */
    .price-headline-card {
        margin-bottom: 0.55rem;
    }
    .price-primary-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin-bottom: 0.25rem;
    }
    .price-live-display {
        display: flex;
        align-items: baseline;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }
    .currency-symbol {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--text-muted);
        margin-right: 2px;
    }
    .price-digits {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        transition: color 0.3s ease, transform 0.2s ease;
    }
    .price-digits.flash-up {
        color: var(--emerald);
        transform: scale(1.02);
    }
    .price-digits.flash-down {
        color: var(--rose);
        transform: scale(0.98);
    }
    .live-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: var(--emerald-bg);
        border: 1px solid var(--emerald-border);
        color: var(--emerald);
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.675rem;
        font-weight: 700;
        letter-spacing: 0.05em;
    }
    .pulse-beacon {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #10B981;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        animation: beacon-pulse 1.8s infinite;
    }
    @keyframes beacon-pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
        70% {
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
        }
    }
    .price-sub-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .ref-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        padding: 0.15rem 0.5rem;
        border-radius: 5px;
        font-size: 0.75rem;
    }
    .ref-title {
        color: var(--text-muted);
        font-weight: 500;
    }
    .ref-val {
        color: var(--text-secondary);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
    .delta-badge {
        font-size: 0.725rem;
        font-weight: 700;
        padding: 0.12rem 0.45rem;
        border-radius: 5px;
        font-variant-numeric: tabular-nums;
    }
    .delta-badge.up {
        background: var(--emerald-bg);
        color: var(--emerald);
        border: 1px solid var(--emerald-border);
    }
    .delta-badge.down {
        background: var(--rose-bg);
        color: var(--rose);
        border: 1px solid var(--rose-border);
    }

    /* Bottom Weather & Macro Phase Block */
    .weather-card {
        margin-top: 1rem;
        padding: 1.15rem 1.45rem;
        border-radius: 14px;
        transition: all 0.2s ease;
    }
    .weather-card.weather-calm {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
    }
    .weather-card.weather-sunny {
        background: linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%);
        border: 1px solid var(--emerald-border);
    }
    .weather-card.weather-warning {
        background: linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%);
        border: 1px solid var(--amber-border);
    }
    .weather-card.weather-storm {
        background: linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%);
        border: 1px solid var(--rose-border);
    }

    .weather-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.25rem;
        margin-bottom: 0.85rem;
        flex-wrap: wrap;
    }
    .weather-meta {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        max-width: 680px;
    }
    .weather-icon-badge {
        font-size: 2.1rem;
        line-height: 1;
        flex-shrink: 0;
    }
    .weather-status-heading {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.2rem;
        flex-wrap: wrap;
    }
    .weather-status-name {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.01em;
    }
    .weather-phase-tag {
        font-size: 0.725rem;
        font-weight: 700;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        color: var(--text-secondary);
    }
    .weather-forecast-narrative {
        font-size: 0.825rem;
        color: var(--text-secondary);
        line-height: 1.45;
    }
    .weather-advisory-box {
        background: rgba(255, 255, 255, 0.9);
        border: 1px dashed var(--border-card);
        padding: 0.5rem 0.85rem;
        border-radius: 8px;
        min-width: 250px;
        max-width: 350px;
    }
    .advisory-label {
        font-size: 0.675rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.03em;
        margin-bottom: 0.15rem;
    }
    .advisory-text {
        font-size: 0.775rem;
        color: var(--text-primary);
        font-weight: 600;
        line-height: 1.35;
    }

    /* 4-Phase Stepper Grid */
    .macro-stepper-grid {
        display: grid;
        grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
        align-items: stretch;
        gap: 0.65rem;
        background: var(--bg-subtle);
        padding: 0.75rem 0.85rem;
        border-radius: 10px;
        border: 1px solid var(--border-card);
    }
    .stepper-node {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        border-radius: 8px;
        padding: 0.65rem 0.75rem;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .stepper-node.node-active {
        border-color: var(--text-primary);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
        background: #FFFFFF;
    }
    .stepper-node.node-testing {
        border-color: var(--amber-border);
        background: linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%);
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.08);
    }
    .stepper-node.node-inactive {
        opacity: 0.65;
        background: rgba(255, 255, 255, 0.55);
    }
    .node-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
    }
    .node-step {
        font-size: 0.65rem;
        font-weight: 800;
        color: var(--text-muted);
        letter-spacing: 0.05em;
    }
    .node-badge-here {
        font-size: 0.6rem;
        font-weight: 800;
        background: var(--btn-primary);
        color: #FFFFFF;
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        letter-spacing: 0.02em;
        animation: beacon-pulse 2s infinite;
    }
    .node-badge-testing {
        font-size: 0.575rem;
        font-weight: 800;
        background: var(--amber-bg);
        color: var(--amber);
        border: 1px solid var(--amber-border);
        padding: 0.08rem 0.35rem;
        border-radius: 4px;
        letter-spacing: 0.02em;
    }
    .node-title {
        font-size: 0.825rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 0.15rem;
        white-space: nowrap;
    }
    .node-desc {
        font-size: 0.7rem;
        color: var(--text-muted);
        line-height: 1.3;
    }
    .node-points {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        margin-top: 0.4rem;
        padding-top: 0.4rem;
        border-top: 1px solid var(--border-subtle);
        font-size: 0.675rem;
        color: var(--text-secondary);
        line-height: 1.3;
    }
    .stepper-arrow {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-muted);
        text-align: center;
        user-select: none;
        align-self: center;
    }
    .stepper-arrow.arrow-active {
        color: var(--text-primary);
    }

    @media (max-width: 950px) {
        .macro-stepper-grid {
            grid-template-columns: 1fr;
            gap: 0.5rem;
        }
        .stepper-arrow {
            display: none;
        }
        .weather-top-row {
            flex-direction: column;
            align-items: flex-start;
        }
        .weather-advisory-box {
            max-width: 100%;
            width: 100%;
        }
    }

    /* ======================================================== */
    /* RADAR TOÀN CẢNH STYLING                                  */
    /* ======================================================== */
    .radar-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .radar-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.15rem;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .radar-filters-row {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        align-items: center;
    }
    .filter-pill {
        padding: 0.28rem 0.65rem;
        border-radius: 9999px;
        font-size: 0.725rem;
        font-weight: 600;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }
    .filter-pill:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border-color: var(--text-muted);
    }
    .filter-pill.active {
        background: var(--text-primary);
        color: var(--bg-primary) !important;
        border-color: var(--text-primary);
    }
    .pill-markup.active {
        background: var(--emerald) !important;
        color: #FFFFFF !important;
        border-color: var(--emerald) !important;
    }
    .pill-accum.active {
        background: #0284c7 !important;
        color: #FFFFFF !important;
        border-color: #0284c7 !important;
    }
    .pill-dist.active {
        background: var(--amber) !important;
        color: #FFFFFF !important;
        border-color: var(--amber) !important;
    }
    .pill-markd.active {
        background: var(--rose) !important;
        color: #FFFFFF !important;
        border-color: var(--rose) !important;
    }
    .pill-actionable {
        border-color: var(--emerald);
        color: var(--emerald);
    }
    .pill-actionable.active {
        background: var(--emerald) !important;
        color: #FFFFFF !important;
    }
    .radar-matrix-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(295px, 1fr));
        gap: 0.85rem;
    }
    .radar-tile {
        padding: 0.95rem 1.05rem;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.65rem;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        position: relative;
    }
    .radar-tile:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
        border-color: var(--text-muted);
    }
    .tile-actionable {
        border: 1.5px solid var(--emerald) !important;
        box-shadow: 0 0 14px rgba(16, 185, 129, 0.18);
    }
    .tile-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .tile-symbol-group {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
    }
    .tile-symbol-tag {
        font-weight: 800;
        font-size: 1rem;
        color: var(--text-primary);
        letter-spacing: -0.02em;
    }
    .tile-price-group {
        display: flex;
        align-items: baseline;
        gap: 0.3rem;
    }
    .tile-price {
        font-size: 0.875rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
    }
    .tile-change {
        font-size: 0.675rem;
        font-weight: 700;
    }
    .tile-change.up {
        color: var(--emerald);
    }
    .tile-change.down {
        color: var(--rose);
    }
    .tile-phase-badge {
        font-size: 0.675rem;
        font-weight: 700;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        white-space: nowrap;
    }
    .tile-phase-badge.weather-sunny {
        background: var(--emerald-bg);
        border: 1px solid var(--emerald-border);
        color: var(--emerald);
    }
    .tile-phase-badge.weather-calm {
        background: rgba(2, 132, 199, 0.1);
        border: 1px solid rgba(2, 132, 199, 0.25);
        color: #0284c7;
    }
    .tile-phase-badge.weather-warning {
        background: var(--amber-bg);
        border: 1px solid var(--amber-border);
        color: var(--amber);
    }
    .tile-phase-badge.weather-storm {
        background: var(--rose-bg);
        border: 1px solid var(--rose-border);
        color: var(--rose);
    }
    .tile-meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.725rem;
        color: var(--text-secondary);
    }
    .tile-progress-text {
        font-size: 0.675rem;
        color: #9333ea;
        font-weight: 600;
    }
    .tile-range-box {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        background: var(--bg-tertiary);
        padding: 0.45rem 0.6rem;
        border-radius: 6px;
    }
    .tile-range-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.675rem;
        font-weight: 500;
    }
    .range-lbl-sup {
        color: var(--emerald);
    }
    .range-lbl-res {
        color: var(--rose);
    }
    .tile-range-track {
        height: 4px;
        width: 100%;
        background: var(--border-subtle);
        border-radius: 2px;
        overflow: hidden;
    }
    .tile-range-fill {
        height: 100%;
        border-radius: 2px;
        background: var(--emerald);
        transition: width 0.3s ease;
    }
    .tile-range-fill.weather-storm {
        background: var(--rose);
    }
    .tile-range-fill.weather-warning {
        background: var(--amber);
    }
    .tile-range-fill.weather-calm {
        background: #0284c7;
    }
    .tile-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid var(--border-subtle);
        padding-top: 0.45rem;
        margin-top: 0.1rem;
    }
    .tile-view-link {
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--text-muted);
        transition: color 0.2s;
    }
    .radar-tile:hover .tile-view-link {
        color: var(--text-primary);
    }
</style>
