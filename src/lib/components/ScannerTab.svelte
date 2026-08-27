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

    // Navigation state: 'radar' (default) | 'single' | 'scan'
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

    // Scan state
    let scanData = null;
    let dataSource = 'LOADING';
    let isScanLoading = false;

    async function loadRadarData() {
        isRadarLoading = true;
        try {
            // 1. Fetch Radar analysis from Backend (has all 15 coins with full Wyckoff & reference prices)
            const analysesPromise = fetchUniverseRadar('4h', 1000).then(analyses => {
                radarData = analyses;
                isRadarLoading = false; // Render cards immediately as soon as backend returns!
            });

            // 2. Fetch Binance 24h tickers asynchronously in the background without blocking UI
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
        const cached = radarData.find(item => item.symbol === sym);
        if (cached && cached.analysis) {
            singleAnalysisData = cached.analysis;
            isSingleLoading = false;
        }
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

    const PHASE_SECTION_DEFS = [
        {
            phase: 'MARKUP',
            title: 'Pha 2: Đẩy Giá (Markup) — Dòng Tiền Lớn Kiểm Soát',
            emoji: '🚀',
            badgeClass: 'weather-sunny',
            desc: 'Các coin đang trong chu kỳ tăng trưởng mạnh mẽ, phe Mua làm chủ hoàn toàn cấu trúc sóng.'
        },
        {
            phase: 'ACCUMULATION',
            title: 'Pha 1: Tích Lũy (Accumulation) — Cá Mập Gom Hàng Đáy',
            emoji: '🌊',
            badgeClass: 'weather-calm',
            desc: 'Các coin đang trong vùng đáy hấp thụ cạn cung, chuẩn bị bước vào chu kỳ tăng trưởng mới.'
        },
        {
            phase: 'DISTRIBUTION',
            title: 'Pha 3: Phân Phối (Distribution) — Cảnh Báo Xả Đỉnh',
            emoji: '⚠️',
            badgeClass: 'weather-warning',
            desc: 'Các coin ở vùng đỉnh rủi ro, lực cầu suy yếu và xuất hiện áp lực phân phối chốt lời.'
        },
        {
            phase: 'MARKDOWN',
            title: 'Pha 4: Giảm Giá (Markdown) — Xu Hướng Thoái Trào',
            emoji: '⛈️',
            badgeClass: 'weather-storm',
            desc: 'Các coin bị thủng hỗ trợ, phe Bán áp đảo, xu hướng suy thoái đang tiếp diễn.'
        },
        {
            phase: 'UNRESOLVED',
            title: 'Chưa Chốt Pha — Dao Động Cân Bằng Biên Độ',
            emoji: '🌫️',
            badgeClass: 'weather-calm',
            desc: 'Các coin đang dao động trung tính giữa 2 cản, chưa hình thành chu kỳ có hướng rõ ràng.'
        }
    ];

    $: radarSections = PHASE_SECTION_DEFS.map(def => {
        const items = filteredRadarList.filter(item => {
            const p = (item.analysis?.market_state?.cycle_phase?.phase || 'UNRESOLVED').toUpperCase();
            if (def.phase === 'UNRESOLVED') {
                return p !== 'MARKUP' && p !== 'ACCUMULATION' && p !== 'DISTRIBUTION' && p !== 'MARKDOWN';
            }
            return p === def.phase;
        });
        return { ...def, items };
    }).filter(sec => sec.items.length > 0);

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
        
        // Canonical Wyckoff V2 state object from backend
        const cycle = data.market_state?.cycle_phase;
        const typedPhase = (cycle?.phase || 'UNRESOLVED').toUpperCase();
        const stage = cycle?.stage || 'EARLY';
        const strength = cycle?.authority || cycle?.strength || 'PROVISIONAL';
        const validity = cycle?.validity || 'CURRENT';
        const progress = cycle?.progress || 'STABLE';
        const effectiveFrom = cycle?.effective_from || cycle?.effectiveFrom || null;
        const reason = cycle?.reason || '';
        const pattern = cycle?.sequence_pattern || '';
        const version = cycle?.version || '2.4.0';
        const phaseOrdinal = cycle?.phase_ordinal ?? cycle?.phaseOrdinal ?? 0;
        const legOrdinal = cycle?.leg_ordinal ?? cycle?.legOrdinal ?? 0;

        const stageVi = translateCycleStage(stage);
        const strengthVi = translateStrength(strength);
        const validityVi = translateCycleValidity(validity);
        const progressVi = translateCycleProgress(progress);
        const reasonVi = translateCycleReason(reason);
        const patternVi = translateSequencePattern(pattern);
        // 1. MARKUP (Pha 2: Đẩy Giá)
        if (typedPhase === 'MARKUP') {
            return {
                phaseId: 'MARKUP',
                phaseStep: 2,
                phaseName: `Pha 2: Đẩy Giá · ${stageVi}`,
                phaseBadge: 'ĐẨY GIÁ',
                phaseOrdinal,
                legOrdinal,
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
                weatherTitle: `Trời Trong · Đẩy Giá (${progressVi})`,
                weatherClass: 'weather-sunny',
                weatherSummary: `Cấu trúc sóng tăng đẩy giá (${stageVi}). Phe Mua kiểm soát đà tăng${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: '⚡ Lực Cầu Hoàn Toàn Kiểm Soát'
            };
        }

        // 2. ACCUMULATION (Pha 1: Tích Lũy)
        if (typedPhase === 'ACCUMULATION') {
            return {
                phaseId: 'ACCUMULATION',
                phaseStep: 1,
                phaseName: `Pha 1: Tích Lũy · ${stageVi}`,
                phaseBadge: 'TÍCH LŨY',
                phaseOrdinal,
                legOrdinal,
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
                weatherTitle: `Sóng Êm · Vùng Tích Lũy Gom Hàng (${progressVi})`,
                weatherClass: 'weather-calm',
                weatherSummary: `Thị trường đang trong pha Tích Lũy (${stageVi}). Lực cung đáy đang được hấp thụ${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: strength === 'CONFIRMED' ? '🌊 Hấp Thụ Cung Đáy Hoàn Tất' : '🌊 Đang Hấp Thụ Cung Đáy'
            };
        }

        // 3. DISTRIBUTION (Pha 3: Phân Phối)
        if (typedPhase === 'DISTRIBUTION') {
            return {
                phaseId: 'DISTRIBUTION',
                phaseStep: 3,
                phaseName: `Pha 3: Phân Phối · ${stageVi}`,
                phaseBadge: 'PHÂN PHỐI',
                phaseOrdinal,
                legOrdinal,
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
                weatherTitle: `Cảnh Báo Giông · Phân Phối Đỉnh (${progressVi})`,
                weatherClass: 'weather-warning',
                weatherSummary: `Thị trường đang trong pha Phân Phối (${stageVi}). Áp lực bán xả hàng vùng đỉnh${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: strength === 'CONFIRMED' ? '⚠️ Cung Xả Đỉnh Xác Nhận' : '⚠️ Áp Lực Cung Xả Đỉnh'
            };
        }

        // 4. MARKDOWN (Pha 4: Giảm Giá)
        if (typedPhase === 'MARKDOWN') {
            const isAbsorbing = progress === 'DECELERATING' || progress === 'EXHAUSTING' || (vpa && vpa.type === 'HIGH_EFFORT_LOW_RESULT');
            return {
                phaseId: 'MARKDOWN',
                phaseStep: 4,
                phaseName: isAbsorbing ? `Pha 4: Hãm Đà Giảm · ${stageVi}` : `Pha 4: Giảm Giá · ${stageVi}`,
                phaseBadge: isAbsorbing ? 'HÃM ĐÀ GIẢM' : 'GIẢM GIÁ',
                phaseOrdinal,
                legOrdinal,
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
                weatherTitle: isAbsorbing ? `Mây Mù Tan Dần · Hãm Đà Giảm (${progressVi})` : `Mưa Giông · Giảm Giá (${progressVi})`,
                weatherClass: isAbsorbing ? 'weather-warning' : 'weather-storm',
                weatherSummary: isAbsorbing
                    ? `Đà giảm đang chững lại (${stageVi}). Lực cầu cá mập đang hấp thụ cung tạo đáy${reasonVi ? ` · ${reasonVi}` : ''}.`
                    : `Cấu trúc suy thoái (${stageVi}). Phe Bán hoàn toàn áp đảo thị trường${reasonVi ? ` · ${reasonVi}` : ''}.`,
                pressure: isAbsorbing ? '⛅ Cung Vĩ Mô Đang Bị Hấp Thụ' : '⛈️ Lực Cung Hoàn Toàn Áp Đảo'
            };
        }

        // 5. UNRESOLVED / ACTIVE RANGE
        return {
            phaseId: 'UNRESOLVED_RANGE',
            phaseStep: 0,
            phaseName: `Range: ${rangeState} · Pha: Chưa Chốt`,
            phaseBadge: 'CHƯA CHỐT PHA',
            phaseLegVi: '',
            phaseOrdinal,
            legOrdinal,
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
            weatherEmoji: '🌫️',
            weatherTitle: `Mây Mù · Vùng Cân Bằng Giằng Co`,
            weatherClass: 'weather-calm',
            weatherSummary: `Thị trường đang dao động trong biên độ cân bằng. Chưa chốt pha vĩ mô hoàn chỉnh${reasonVi ? ` · ${reasonVi}` : ''}.`,
            pressure: '⚖️ Cân Bằng Cung – Cầu Trong Biên'
        };
    }

    $: marketWeather = computeMarketWeather(singleAnalysisData);

    onMount(() => {
        loadRadarData();
        if (activeView === 'single') {
            loadSingleAnalysis(selectedSymbol);
        }
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

<!-- Single Consolidated Top Control Strip -->
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
            on:click={() => {
                activeView = 'single';
                if (!singleAnalysisData) {
                    const cached = radarData.find(item => item.symbol === selectedSymbol);
                    if (cached && cached.analysis) singleAnalysisData = cached.analysis;
                    loadSingleAnalysis(selectedSymbol);
                }
            }}
        >
            🔍 Phân Tích ({cleanSymbol(selectedSymbol)})
        </button>
    </div>

    {#if activeView === 'radar'}
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
            <button 
                class="filter-pill" 
                style="padding: 0.25rem 0.5rem;"
                on:click={loadRadarData} 
                disabled={isRadarLoading}
                title="Làm mới dữ liệu"
            >
                {isRadarLoading ? '⌛' : '🔄'}
            </button>
        </div>
    {:else if activeView === 'single'}
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

        {#if isRadarLoading && radarData.length === 0}
            <div class="card" style="padding: 4rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.25rem; margin-bottom: 0.5rem; font-weight: 600;">⌛ Đang nạp radar khí tượng 15 đồng coin...</div>
                <div style="font-size: 0.85rem;">Phân tích song song mô hình Wyckoff V2 & kết nối giá Binance Realtime</div>
            </div>
        {:else}
            {#each radarSections as section (section.phase)}
                <div class="radar-phase-section">
                    <!-- Section Header -->
                    <div class="radar-section-header {section.badgeClass}">
                        <div class="section-title-group">
                            <span class="section-emoji">{section.emoji}</span>
                            <div>
                                <div class="section-title">{section.title}</div>
                                <div class="section-desc">{section.desc}</div>
                            </div>
                        </div>
                        <span class="section-count-badge">
                            {section.items.length} Coin
                        </span>
                    </div>

                    <!-- Matrix Grid for this Section -->
                    <div class="radar-matrix-grid">
                        {#each section.items as item (item.symbol)}
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

                                <!-- Tile Wyckoff V2 Sub-State Badges -->
                                {#if weather}
                                    <div class="tile-substate-row">
                                        {#if weather.stage === 'EARLY' && (weather.progress === 'ACCELERATING' || weather.progress === 'STABLE')}
                                            <span class="v2-tag tag-early">🚀 Mới Vào Sóng</span>
                                        {:else if weather.stage === 'LATE' || weather.progress === 'EXHAUSTING'}
                                            <span class="v2-tag tag-late">⚠️ Cuối Sóng · Cạn Đà</span>
                                        {:else if weather.stage === 'MIDDLE'}
                                            <span class="v2-tag tag-mid">📈 Đang Tăng Trưởng</span>
                                        {:else if weather.stageVi}
                                            <span class="v2-tag tag-stage">{weather.stageVi}</span>
                                        {/if}

                                        {#if weather.progress && weather.progress !== 'STABLE'}
                                            <span class="v2-tag tag-progress">{weather.progressVi}</span>
                                        {/if}

                                        {#if weather.strength === 'CONFIRMED'}
                                            <span class="v2-tag tag-confirmed">🛡️ Đã Xác Nhận</span>
                                        {:else}
                                            <span class="v2-tag tag-provisional">⏳ Thăm Dò</span>
                                        {/if}
                                    </div>
                                {/if}

                                <!-- Wyckoff V2 Context & Structure Snippet -->
                                {#if weather && (weather.reasonVi || weather.patternVi)}
                                    <div class="tile-context-line" title="{weather.reasonVi || weather.patternVi}">
                                        {weather.reasonVi || weather.patternVi}
                                    </div>
                                {/if}

                                <!-- Dynamic Actionable Setup Details (Only displayed when there is an active buy/sell setup) -->
                                {#if analysis?.action === 'BUY_READY' || analysis?.action === 'SHORT_READY'}
                                    <div class="tile-setup-box" on:click|stopPropagation role="none">
                                        <div class="tile-setup-metrics">
                                            <span><strong>Entry:</strong> ${formatPrice(analysis.plan?.entry)}</span>
                                            <span><strong>SL:</strong> ${formatPrice(analysis.plan?.stop)}</span>
                                            <span><strong>TP:</strong> ${formatPrice(analysis.plan?.target)}</span>
                                            <span><strong>R:R:</strong> {analysis.plan?.reward_risk ? `${analysis.plan.reward_risk.toFixed(1)}R` : 'N/A'}</span>
                                        </div>
                                        <button 
                                            class="btn btn-emerald" 
                                            style="width: 100%; padding: 0.32rem 0.5rem; font-size: 0.775rem; font-weight: 700; margin-top: 0.35rem;"
                                            on:click|stopPropagation={() => onOpenOrderModal(
                                                item.symbol,
                                                analysis.plan?.direction || 'LONG',
                                                analysis.plan?.entry,
                                                analysis.plan?.stop,
                                                analysis.plan?.target
                                            )}
                                        >
                                            📋 Đặt Lệnh ({analysis.plan?.direction} @ ${formatPrice(analysis.plan?.entry)})
                                        </button>
                                    </div>
                                {/if}

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
                </div>
            {/each}
        {/if}
    </div>

{:else if activeView === 'single'}
    <!-- ======================================================== -->
    <!-- AIRY & SPACIOUS 2-COLUMN COCKPIT VIEW                     -->
    <!-- ======================================================== -->
    {#if isSingleLoading}
        <div class="card" style="padding: 3.5rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⌛ Đang phân tích dữ liệu 1000 nến 4H cho {selectedSymbol}...</div>
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
                <!-- Unified Sleek Price & Market Status Header -->
                <div class="cockpit-header">
                    <div class="cockpit-header-left">
                        <div class="cockpit-symbol-row">
                            <span class="cockpit-symbol-name">{cleanSymbol(selectedSymbol)}/USDT</span>
                            <span class="status-pill {act.class}" style="font-size: 0.725rem; padding: 0.15rem 0.5rem;">
                                <span class="dot"></span>
                                {act.text}
                            </span>
                        </div>
                        <div class="cockpit-price-row">
                            <span class="cockpit-price-val {priceFlash || ''}">${formatPrice(currentDisplayPrice)}</span>
                            {#if livePrice && Math.abs(priceDiffPct) >= 0.01}
                                <span class="cockpit-delta {priceDiff >= 0 ? 'up' : 'down'}" title="Độ lệch so với giá đóng nến 4H">
                                    {priceDiff >= 0 ? '+' : ''}{priceDiffPct.toFixed(2)}%
                                </span>
                            {/if}
                        </div>
                    </div>
                    
                    <div class="cockpit-header-right">
                        <div class="cockpit-ref-info">
                            <span>Tham chiếu 4H: <strong>${formatPrice(refPriceNum)}</strong></span>
                            {#if singleAnalysisData.as_of}
                                <span class="cockpit-time">{formatVNTime(singleAnalysisData.as_of)}</span>
                            {/if}
                        </div>
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
                        {#if marketWeather.reasonVi || marketWeather.patternVi}
                            <div style="font-size: 0.725rem; color: var(--text-secondary); margin-top: 0.25rem; line-height: 1.35;">
                                <strong>Đặc tả Wyckoff:</strong> {marketWeather.reasonVi || marketWeather.patternVi}
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

                <!-- ==================================================== -->
                <!-- WYCKOFF V2 STATE-DRIVEN CYCLE INSPECTOR              -->
                <!-- ==================================================== -->
                <div class="v2-cycle-inspector-grid">
                    <!-- Panel 1: Stage & Momentum -->
                    <div class="v2-inspector-panel">
                        <div class="v2-panel-head">
                            <span class="v2-panel-icon">📊</span>
                            <span class="v2-panel-title">Tiến Trình & Động Lượng Sóng</span>
                        </div>
                        <div class="v2-panel-body">
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Giai đoạn chu kỳ:</span>
                                <span class="v2-val font-semibold">{marketWeather.stageVi || 'Giai đoạn đầu'}</span>
                            </div>
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Động lượng đà giá:</span>
                                <span class="v2-val font-semibold {marketWeather.progress === 'ACCELERATING' ? 'text-emerald' : marketWeather.progress === 'EXHAUSTING' ? 'text-amber' : ''}">
                                    {marketWeather.progressVi || 'Ổn định'}
                                </span>
                            </div>
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Áp suất Cung – Cầu:</span>
                                <span class="v2-val">{marketWeather.pressure}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Panel 2: Authority & Validation -->
                    <div class="v2-inspector-panel">
                        <div class="v2-panel-head">
                            <span class="v2-panel-icon">🛡️</span>
                            <span class="v2-panel-title">Quyền Hạn & Tính Xác Thực</span>
                        </div>
                        <div class="v2-panel-body">
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Quyền hạn chu kỳ:</span>
                                <span class="v2-val {marketWeather.strength === 'CONFIRMED' ? 'text-emerald font-bold' : 'text-amber font-semibold'}">
                                    {marketWeather.strengthVi || 'Đã Xác Nhận'}
                                </span>
                            </div>
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Tính hợp lệ nến:</span>
                                <span class="v2-val">{marketWeather.validityVi || 'Hợp Lệ (Current)'}</span>
                            </div>
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Mốc chốt pha:</span>
                                <span class="v2-val font-mono">{marketWeather.effectiveFrom ? formatVNTime(marketWeather.effectiveFrom) : 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Panel 3: Transition & Action Watchlist -->
                    <div class="v2-inspector-panel">
                        <div class="v2-panel-head">
                            <span class="v2-panel-icon">🧭</span>
                            <span class="v2-panel-title">Bằng Chứng & Kịch Bản Chuyển Pha</span>
                        </div>
                        <div class="v2-panel-body">
                            <div class="v2-detail-row">
                                <span class="v2-lbl">Nguyên nhân V2:</span>
                                <span class="v2-val font-semibold text-primary">{marketWeather.reasonVi || marketWeather.patternVi || 'Tiếp diễn xu hướng'}</span>
                            </div>
                            <div class="v2-tip-box">
                                {#if marketWeather.phaseId === 'MARKUP'}
                                    💡 <strong>Chiến lược:</strong> Tiếp tục Follow Trend phe Mua. Cảnh báo đảo chiều nếu xuất hiện nến Vol lớn thân hẹp (Cá mập xả ngầm) hoặc thủng cản Hỗ trợ.
                                {:else if marketWeather.phaseId === 'ACCUMULATION'}
                                    💡 <strong>Chiến lược:</strong> Canh tìm điểm vào chân sóng ở đáy Range. Xác nhận vào Pha 2 Đẩy Giá khi đóng nến vượt Kháng Cự với Vol lớn.
                                {:else if marketWeather.phaseId === 'DISTRIBUTION'}
                                    💡 <strong>Chiến lược:</strong> Vùng đỉnh phân phối rủi ro. Canh chốt lời hoặc thiết lập vị thế Bán (Short) khi xuất hiện bẫy tăng giá (UTAD).
                                {:else if marketWeather.phaseId === 'MARKDOWN'}
                                    💡 <strong>Chiến lược:</strong> Xu hướng giảm đang tiếp diễn. Không bắt dao rơi cho đến khi xuất hiện nến cao trào hãm đà (Selling Climax) và cạn cung.
                                {:else}
                                    💡 <strong>Chiến lược:</strong> Giá đang dao động trong biên. Kiên nhẫn chờ nến 4H đóng bứt phá dứt khoát ra khỏi cản để xác nhận pha mới.
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    {/if}
{/if}

<style>
    .top-control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.85rem;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .view-toggle-group {
        display: flex;
        gap: 0.25rem;
        background: var(--bg-subtle);
        padding: 0.25rem;
        border-radius: 9999px;
        border: 1px solid var(--border-card);
    }
    .view-toggle-group .pill-btn {
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-secondary);
        padding: 0.35rem 0.85rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .view-toggle-group .pill-btn:hover {
        color: var(--text-primary);
    }
    .view-toggle-group .pill-btn.active {
        background: #FFFFFF;
        color: var(--text-primary) !important;
        border-color: var(--border-card);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        font-weight: 700;
    }
    .cockpit-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 0.85rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #E2E8F0;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .cockpit-header-left {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .cockpit-symbol-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .cockpit-symbol-name {
        font-size: 1.1rem;
        font-weight: 800;
        color: #0F172A;
        letter-spacing: -0.01em;
    }
    .cockpit-price-row {
        display: flex;
        align-items: baseline;
        gap: 0.55rem;
        flex-wrap: wrap;
    }
    .cockpit-price-val {
        font-size: 1.75rem;
        font-weight: 800;
        color: #0F172A;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
        line-height: 1.1;
        transition: color 0.3s ease, transform 0.2s ease;
    }
    .cockpit-price-val.flash-up {
        color: #166534;
        transform: scale(1.02);
    }
    .cockpit-price-val.flash-down {
        color: #991B1B;
        transform: scale(0.98);
    }
    .cockpit-delta {
        font-size: 0.725rem;
        font-weight: 600;
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        font-variant-numeric: tabular-nums;
    }
    .cockpit-delta.up {
        background: #DCFCE7;
        color: #166534;
        border: 1px solid #BBF7D0;
    }
    .cockpit-delta.down {
        background: #FEE2E2;
        color: #991B1B;
        border: 1px solid #FECACA;
    }
    .cockpit-live-dot {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.65rem;
        font-weight: 700;
        color: #166534;
        background: #F0FDF4;
        border: 1px solid #BBF7D0;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        letter-spacing: 0.04em;
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
    .cockpit-header-right {
        text-align: right;
    }
    .cockpit-ref-info {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.775rem;
        color: #64748B;
    }
    .cockpit-ref-info strong {
        color: #334155;
    }
    .cockpit-time {
        font-size: 0.725rem;
        color: #94A3B8;
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

    /* Wyckoff V2 State-Driven Cycle Inspector Grid */
    .v2-cycle-inspector-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 0.85rem;
        background: #FFFFFF;
        padding: 0.85rem;
        border-radius: 12px;
        border: 1px solid var(--border-card);
    }
    .v2-inspector-panel {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 0.85rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.65rem;
    }
    .v2-panel-head {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        border-bottom: 1px solid #E2E8F0;
        padding-bottom: 0.45rem;
    }
    .v2-panel-icon {
        font-size: 1.1rem;
    }
    .v2-panel-title {
        font-size: 0.825rem;
        font-weight: 700;
        color: #0F172A;
        letter-spacing: -0.01em;
    }
    .v2-panel-body {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .v2-detail-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.5rem;
        font-size: 0.775rem;
    }
    .v2-lbl {
        color: #64748B;
        font-weight: 500;
    }
    .v2-val {
        color: #0F172A;
        text-align: right;
    }
    .v2-tip-box {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        padding: 0.5rem 0.65rem;
        font-size: 0.725rem;
        color: #334155;
        line-height: 1.4;
        margin-top: 0.25rem;
    }
    .text-emerald {
        color: #166534 !important;
    }
    .text-amber {
        color: #B45309 !important;
    }
    .text-primary {
        color: #0F172A !important;
    }
    .font-semibold {
        font-weight: 600;
    }
    .font-bold {
        font-weight: 700;
    }
    .font-mono {
        font-family: var(--font-mono, monospace);
    }

    @media (max-width: 950px) {
        .v2-cycle-inspector-grid {
            grid-template-columns: 1fr;
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
    .radar-filters-row {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
        align-items: center;
    }
    .filter-pill {
        padding: 0.25rem 0.55rem;
        border-radius: 9999px;
        font-size: 0.725rem;
        font-weight: 600;
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .filter-pill:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
        border-color: #CBD5E1;
    }
    .filter-pill.active {
        background: #0F172A;
        color: #FFFFFF !important;
        border-color: #0F172A;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .pill-markup.active {
        background: #166534 !important;
        color: #FFFFFF !important;
        border-color: #166534 !important;
    }
    .pill-accum.active {
        background: #0284c7 !important;
        color: #FFFFFF !important;
        border-color: #0284c7 !important;
    }
    .pill-dist.active {
        background: #b45309 !important;
        color: #FFFFFF !important;
        border-color: #b45309 !important;
    }
    .pill-markd.active {
        background: #991b1b !important;
        color: #FFFFFF !important;
        border-color: #991b1b !important;
    }
    .pill-actionable {
        border-color: var(--emerald);
        color: var(--emerald);
    }
    .pill-actionable.active {
        background: #166534 !important;
        color: #FFFFFF !important;
    }
    .radar-phase-section {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        margin-bottom: 0.5rem;
    }
    .radar-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: #FFFFFF;
        border-radius: 10px;
        border: 1px solid #CBD5E1;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .radar-section-header.weather-sunny {
        background: linear-gradient(90deg, #F0FDF4 0%, #FFFFFF 100%);
        border-left: 4px solid #10B981;
    }
    .radar-section-header.weather-calm {
        background: linear-gradient(90deg, #F0F9FF 0%, #FFFFFF 100%);
        border-left: 4px solid #0284C7;
    }
    .radar-section-header.weather-warning {
        background: linear-gradient(90deg, #FFFBEB 0%, #FFFFFF 100%);
        border-left: 4px solid #F59E0B;
    }
    .radar-section-header.weather-storm {
        background: linear-gradient(90deg, #FEF2F2 0%, #FFFFFF 100%);
        border-left: 4px solid #EF4444;
    }
    .section-title-group {
        display: flex;
        align-items: center;
        gap: 0.65rem;
    }
    .section-emoji {
        font-size: 1.35rem;
    }
    .section-title {
        font-size: 0.925rem;
        font-weight: 800;
        color: #0F172A;
        letter-spacing: -0.01em;
    }
    .section-desc {
        font-size: 0.725rem;
        color: #64748B;
        margin-top: 0.1rem;
    }
    .section-count-badge {
        font-size: 0.75rem;
        font-weight: 700;
        background: #F1F5F9;
        color: #334155;
        padding: 0.25rem 0.65rem;
        border-radius: 9999px;
        border: 1px solid #E2E8F0;
    }
    .radar-matrix-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(295px, 1fr));
        gap: 0.85rem;
    }
    .radar-tile {
        padding: 1rem 1.15rem;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.75rem;
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03);
        position: relative;
    }
    .radar-tile:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.09);
        border-color: #94A3B8;
    }
    .tile-actionable {
        border: 2px solid #10B981 !important;
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.22);
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
        font-size: 1.05rem;
        color: #0F172A;
        letter-spacing: -0.02em;
    }
    .tile-price-group {
        display: flex;
        align-items: baseline;
        gap: 0.35rem;
    }
    .tile-price {
        font-size: 0.925rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: #0F172A;
    }
    .tile-change {
        font-size: 0.7rem;
        font-weight: 700;
    }
    .tile-change.up {
        color: #166534;
    }
    .tile-change.down {
        color: #991B1B;
    }
    .tile-phase-badge {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        white-space: nowrap;
    }
    .tile-phase-badge.weather-sunny {
        background: #F0FDF4;
        border: 1px solid #BBF7D0;
        color: #166534;
    }
    .tile-phase-badge.weather-calm {
        background: #F0F9FF;
        border: 1px solid #BAE6FD;
        color: #0369A1;
    }
    .tile-phase-badge.weather-warning {
        background: #FFFBEB;
        border: 1px solid #FDE68A;
        color: #B45309;
    }
    .tile-phase-badge.weather-storm {
        background: #FEF2F2;
        border: 1px solid #FECACA;
        color: #B91C1C;
    }
    .tile-meta-row {
        display: flex;
        align-items: center;
        font-size: 0.725rem;
        color: #64748B;
        font-weight: 500;
    }
    .tile-substate-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
    }
    .v2-tag {
        font-size: 0.675rem;
        font-weight: 700;
        padding: 0.15rem 0.45rem;
        border-radius: 6px;
        white-space: nowrap;
        letter-spacing: -0.01em;
    }
    .v2-tag.tag-early {
        background: #DCFCE7;
        color: #15803D;
        border: 1px solid #BBF7D0;
    }
    .v2-tag.tag-late {
        background: #FEF3C7;
        color: #B45309;
        border: 1px solid #FDE68A;
    }
    .v2-tag.tag-mid {
        background: #E0F2FE;
        color: #0369A1;
        border: 1px solid #BAE6FD;
    }
    .v2-tag.tag-stage {
        background: #F1F5F9;
        color: #475569;
        border: 1px solid #E2E8F0;
    }
    .v2-tag.tag-progress {
        background: #FAF5FF;
        color: #7E22CE;
        border: 1px solid #E9D5FF;
    }
    .v2-tag.tag-confirmed {
        background: #F0FDF4;
        color: #166534;
        border: 1px solid #86EFAC;
    }
    .v2-tag.tag-provisional {
        background: #FFFBEB;
        color: #92400E;
        border: 1px solid #FCD34D;
    }
    .tile-context-line {
        font-size: 0.775rem;
        color: #334155;
        line-height: 1.45;
        background: #F8FAFC;
        padding: 0.45rem 0.7rem;
        border-radius: 8px;
        border: 1px solid #E2E8F0;
        font-weight: 500;
    }
    .tile-setup-box {
        background: #ECFDF5;
        border: 1px solid #A7F3D0;
        border-radius: 8px;
        padding: 0.5rem 0.65rem;
        margin-top: 0.2rem;
    }
    .tile-setup-metrics {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        color: #334155;
        flex-wrap: wrap;
        gap: 0.25rem;
    }
    .tile-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #F1F5F9;
        padding-top: 0.55rem;
        margin-top: 0.15rem;
    }
    .tile-view-link {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748B;
        transition: color 0.2s;
    }
    .radar-tile:hover .tile-view-link {
        color: #0F172A;
    }
</style>
