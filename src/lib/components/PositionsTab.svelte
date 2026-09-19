<script>
    import { onMount, onDestroy } from 'svelte';
    import { fetchOpenPositionsApi, fetchPositionsApi, fetchAnalysis, fetchBinanceLivePrice, closePositionApi, updatePositionStopApi, UNIVERSE_COINS, cleanSymbol, formatPrice, formatVNTime } from '../api.js';
    import { openPositions, getPositionMeta, savePositionMeta, removePositionMeta } from '../stores.js';
    import ClosePositionModal from './ClosePositionModal.svelte';

    export let onOpenOrderModal = (symbol, direction, entry, sl, tp) => {};

    let isLoading = false;
    let positions = [];

    let totalPnlUsdt = 0;
    let totalPnlPercent = 0;
    let totalR = 0;
    let totalCapital = 0;
    let totalNotional = 0;
    let liveTickerTimer = null;
    let isUpdatingLivePrices = false;

    function evaluateActionBanner({ engineRec, reachedStop, reachedTarget, suggestedStop, anaReason, direction, sl, tp, rMultiple, rText, effortType }) {
        let isSell = false;
        let actionTitle = 'TIẾP TỤC NẮM GIỮ';
        let actionBadge = 'badge-emerald';
        let actionDesc = anaReason || `Vị thế an toàn, xu hướng được bảo toàn (${rText}). Tiếp tục nắm giữ theo sóng.`;
        let bannerBg = 'var(--phase-markup-bg)';
        let bannerBorder = 'var(--phase-markup-border)';
        let bannerColor = 'var(--emerald)';
        let actionBtnText = 'Chốt đóng vị thế';
        let actionBtnClass = 'btn-outline';

        // 1. Capital defense / Stop Loss takes absolute precedence
        if (engineRec === 'STOP_LOSS' || reachedStop) {
            isSell = true;
            actionTitle = 'CẮT LỖ BẢO VỆ VỐN';
            actionBadge = 'badge-rose';
            bannerBg = 'var(--phase-markdown-bg)';
            bannerBorder = 'var(--phase-markdown-border)';
            bannerColor = 'var(--rose)';
            actionBtnText = 'Cắt lỗ ngay';
            actionBtnClass = 'btn-rose';
            actionDesc = reachedStop && sl > 0
                ? `Giá đã chạm ngưỡng cắt lỗ bảo vệ ($${formatPrice(sl)}). Khuyến nghị đóng vị thế ngay.`
                : (anaReason || 'Giá đã chạm ngưỡng cắt lỗ bảo vệ. Khuyến nghị đóng vị thế ngay.');
        } else if (engineRec === 'TAKE_PROFIT' || reachedTarget) {
            isSell = true;
            actionTitle = 'CHỐT LỜI (ĐẠT MỤC TIÊU)';
            actionBadge = 'badge-cyan';
            bannerBg = 'var(--phase-accum-bg)';
            bannerBorder = 'var(--phase-accum-border)';
            bannerColor = 'var(--cyan)';
            actionBtnText = 'Chốt lời ngay';
            actionBtnClass = 'btn-emerald';
            actionDesc = reachedTarget && tp > 0
                ? `Vị thế đã chạm mục tiêu chốt lời ($${formatPrice(tp)}). Khuyến nghị chốt lời đóng vị thế để bảo toàn thành quả.`
                : (anaReason || 'Vị thế đã đạt vùng chốt lời mục tiêu. Khuyến nghị chốt lời đóng vị thế.');
        } else if (engineRec === 'TIGHTEN_STOP') {
            isSell = false;
            actionTitle = 'NÂNG STOP-LOSS BẢO VỆ LÃI';
            actionBadge = 'badge-amber';
            bannerBg = 'var(--phase-dist-bg)';
            bannerBorder = 'var(--phase-dist-border)';
            bannerColor = 'var(--amber)';
            actionBtnText = 'Chốt đóng vị thế';
            actionBtnClass = 'btn-outline';
            const moveDir = direction === 'SHORT' ? 'xuống' : 'lên';
            actionDesc = suggestedStop
                ? `Vị thế bứt phá tốt (${rText}). Khuyến nghị dời Stop-loss ${moveDir} $${formatPrice(suggestedStop)} để bảo vệ lợi nhuận.`
                : (anaReason || `Vị thế đang có lãi (${rText}). Khuyến nghị dời Stop-loss về giá vào lệnh (Hòa vốn).`);
        } else if (engineRec === 'EXIT_ON_OPPOSITE_SIGNAL' || engineRec === 'EXIT_ON_OPEN_SURFACE_STRUCTURE_LOSS' || engineRec === 'EXIT_ON_OPEN_SURFACE_MATURE_RUNNER_REVERSAL' || engineRec === 'EXIT') {
            isSell = true;
            actionTitle = 'CHỐT LỜI / THOÁT VỊ THẾ';
            actionBadge = 'badge-rose';
            bannerBg = 'var(--phase-markdown-bg)';
            bannerBorder = 'var(--phase-markdown-border)';
            bannerColor = 'var(--rose)';
            actionBtnText = 'Thoát vị thế';
            actionBtnClass = 'btn-rose';
            actionDesc = anaReason || 'Nến 4H đã đóng xác nhận tín hiệu thoát vị thế. Đóng vị thế ngay.';
        } else if (effortType === 'HIGH_EFFORT_LOW_RESULT') {
            isSell = true;
            actionTitle = 'CHỐT LỜI KHI BỊ XẢ HÀNG';
            actionBadge = 'badge-rose';
            bannerBg = 'var(--phase-markdown-bg)';
            bannerBorder = 'var(--phase-markdown-border)';
            bannerColor = 'var(--rose)';
            actionBtnText = 'Bán ngay';
            actionBtnClass = 'btn-rose';
            actionDesc = 'Nến đóng có áp lực xả hàng lớn của dòng tiền lớn. Đóng vị thế chốt lời ngay.';
        }

        return {
            isSell,
            actionTitle,
            actionBadge,
            actionDesc,
            bannerBg,
            bannerBorder,
            bannerColor,
            actionBtnText,
            actionBtnClass
        };
    }

    export async function loadLivePositions() {
        isLoading = true;
        try {
            const res = await fetchOpenPositionsApi();
            const rawPositions = (res.success && Array.isArray(res.data)) ? res.data : [];

            if (rawPositions.length === 0) {
                positions = [];
                openPositions.set([]);
                totalPnlUsdt = 0;
                totalPnlPercent = 0;
                totalR = 0;
                totalCapital = 0;
                totalNotional = 0;
                return;
            }

            const enrichedPromises = rawPositions.map(async (p) => {
                const sym = p.symbol || 'LINKUSDT';
                const entry = parseFloat(p.entry_price ?? p.entryPrice ?? p.entry) || 0;
                const sl = parseFloat(p.protective_stop ?? p.protectiveStop ?? p.protective_stop_price ?? p.sl) || 0;
                const initialSl = parseFloat(p.initial_protective_stop ?? p.initialProtectiveStop ?? p.initial_protective_stop_price) || sl;
                const tp = parseFloat(p.target ?? p.target_price ?? p.tp) || 0;
                const rawRisk = parseFloat(p.quote_amount ?? p.quoteAmount ?? p.notional_amount ?? p.risk) || 200;
                const direction = (p.direction || 'LONG').toUpperCase();

                const meta = getPositionMeta(sym);
                let leverage = p.leverage || meta?.leverage || 1;
                let margin = p.margin || meta?.margin;

                const rawNotes = p.notes || p.userNotes;
                if (rawNotes) {
                    try {
                        const parsed = typeof rawNotes === 'string' ? JSON.parse(rawNotes) : rawNotes;
                        if (parsed.leverage) leverage = Math.max(1, parseInt(parsed.leverage) || 1);
                        if (parsed.margin) margin = parseFloat(parsed.margin);
                    } catch (_) {}
                }

                // Seed fallback for ZKUSDT (the user's open position: 200 margin, 5x leverage)
                if ((!meta || meta.leverage === 1) && sym === 'ZKUSDT' && rawRisk === 1000) {
                    leverage = 5;
                    margin = 200;
                    savePositionMeta('ZKUSDT', { margin: 200, leverage: 5, notional: 1000 });
                }

                if (!margin || margin <= 0) {
                    margin = rawRisk / leverage;
                }
                const notional = margin * leverage;

                let currentPrice = entry;
                let effortType = 'NORMAL';
                let trend = 'BULLISH';
                let engineRec = null;
                let anaReason = null;
                let suggestedStop = null;
                let stopAction = 'MAINTAIN_STOP';

                try {
                    const [anaRes, liveRes] = await Promise.allSettled([
                        fetchAnalysis(sym),
                        fetchBinanceLivePrice(sym)
                    ]);
                    if (liveRes.status === 'fulfilled' && liveRes.value?.ok && liveRes.value.price) {
                        currentPrice = liveRes.value.price;
                    } else if (anaRes.status === 'fulfilled' && anaRes.value?.success && anaRes.value.data?.reference_price) {
                        currentPrice = parseFloat(anaRes.value.data.reference_price);
                    }
                    if (anaRes.status === 'fulfilled' && anaRes.value?.success && anaRes.value.data) {
                        const d = anaRes.value.data;
                        if (d.market_state?.effort_result?.type) {
                            effortType = d.market_state.effort_result.type;
                        }
                        if (d.market_state?.trend) {
                            trend = d.market_state.trend;
                        }
                        if (d.position) {
                            anaReason = d.position.reason || d.reason;
                            if (d.position.recommendation) {
                                engineRec = d.position.recommendation;
                            }
                            if (d.position.stop_action ?? d.position.stopAction) {
                                stopAction = d.position.stop_action ?? d.position.stopAction;
                            }
                            const rawStop = d.position.suggested_stop ?? d.position.suggestedStop;
                            if (rawStop != null && !isNaN(parseFloat(rawStop))) {
                                suggestedStop = parseFloat(rawStop);
                            }
                        } else if (d.action === 'MANAGE_POSITION') {
                            anaReason = d.reason;
                        }
                    }
                } catch (e) {
                    console.warn(`Could not fetch live analysis for ${sym}:`, e);
                }

                let pnlPercent = 0;
                let pnlUsdt = 0;
                let rMultiple = 0;

                if (entry > 0) {
                    const diffRatio = direction === 'LONG'
                        ? (currentPrice - entry) / entry
                        : (entry - currentPrice) / entry;
                    pnlUsdt = notional * diffRatio;
                    pnlPercent = diffRatio * 100 * leverage;

                    if (direction === 'LONG') {
                        if (entry > initialSl && initialSl > 0) {
                            rMultiple = (currentPrice - entry) / (entry - initialSl);
                        }
                    } else {
                        if (initialSl > entry && initialSl > 0) {
                            rMultiple = (entry - currentPrice) / (initialSl - entry);
                        }
                    }
                }

                // Liquidation price
                let liqPrice = 0;
                if (leverage > 1 && entry > 0) {
                    liqPrice = direction === 'LONG'
                        ? Math.max(0, entry * (1 - 1 / leverage))
                        : entry * (1 + 1 / leverage);
                }

                const reachedTarget = tp > 0 && (
                    (direction === 'LONG' && currentPrice >= tp) ||
                    (direction === 'SHORT' && currentPrice <= tp)
                );
                const reachedStop = sl > 0 && (
                    (direction === 'LONG' && currentPrice <= sl) ||
                    (direction === 'SHORT' && currentPrice >= sl)
                );
                const rText = `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)} R`;

                const banner = evaluateActionBanner({
                    engineRec,
                    reachedStop,
                    reachedTarget,
                    suggestedStop,
                    anaReason,
                    direction,
                    sl,
                    tp,
                    rMultiple,
                    rText,
                    effortType
                });

                return {
                    id: `pos-${p.id}`,
                    rawId: p.id,
                    symbol: sym,
                    direction: direction,
                    status: p.status === 'OPEN' ? 'FILLED' : (p.status || 'FILLED'),
                    statusLabel: p.status === 'OPEN' ? 'Đang Mở' : (p.status || 'Đang Mở'),
                    statusClass: direction === 'LONG' ? 'badge-emerald' : 'badge-rose',
                    entry: entry,
                    currentPrice: currentPrice,
                    sl: sl,
                    initialSl: initialSl,
                    suggestedStop: suggestedStop,
                    stopAction: stopAction,
                    tp: tp,
                    margin: margin,
                    leverage: leverage,
                    notional: notional,
                    risk: margin,
                    liqPrice: liqPrice,
                    policyId: p.policy_id || p.policyId || '',
                    entryTime: p.entry_time || p.entryTime || '',
                    pnlPercent: pnlPercent,
                    pnlUsdt: pnlUsdt,
                    rMultiple: rMultiple,
                    rResult: rText,
                    engineRec: engineRec,
                    effortType: effortType,
                    anaReason: anaReason,
                    ...banner,
                    nextStatus: 'CLOSED'
                };
            });

            const livePositions = await Promise.all(enrichedPromises);
            positions = livePositions;
            openPositions.set(livePositions);

            totalPnlUsdt = positions.reduce((acc, curr) => acc + curr.pnlUsdt, 0);
            totalCapital = positions.reduce((acc, curr) => acc + (curr.margin || curr.risk || 0), 0);
            totalNotional = positions.reduce((acc, curr) => acc + (curr.notional || 0), 0);
            totalR = positions.reduce((acc, curr) => acc + curr.rMultiple, 0);
            totalPnlPercent = totalCapital > 0 ? (totalPnlUsdt / totalCapital) * 100 : 0;

        } catch (err) {
            console.warn('Error loading live positions:', err);
        } finally {
            isLoading = false;
        }
    }

    function startLiveTicker() {
        stopLiveTicker();
        liveTickerTimer = setInterval(async () => {
            if (!positions || positions.length === 0 || isLoading) return;
            await updateLivePrices();
        }, 3000);
    }

    function stopLiveTicker() {
        if (liveTickerTimer) {
            clearInterval(liveTickerTimer);
            liveTickerTimer = null;
        }
    }

    async function updateLivePrices() {
        if (!positions || positions.length === 0 || isUpdatingLivePrices || isLoading) return;
        isUpdatingLivePrices = true;
        try {
            let hasUpdates = false;
            const currentPositionIds = new Set(positions.map(p => p.id));
            const updated = await Promise.all(positions.map(async (pos) => {
                try {
                    const res = await fetchBinanceLivePrice(pos.symbol);
                    if (res.ok && res.price && Math.abs(res.price - pos.currentPrice) > 0.0000001) {
                        hasUpdates = true;
                        const currentPrice = res.price;
                        let pnlUsdt = 0;
                        let pnlPercent = 0;
                        let rMultiple = 0;

                        if (pos.entry > 0) {
                            const diffRatio = pos.direction === 'LONG'
                                ? (currentPrice - pos.entry) / pos.entry
                                : (pos.entry - currentPrice) / pos.entry;
                            pnlUsdt = pos.notional * diffRatio;
                            pnlPercent = diffRatio * 100 * pos.leverage;

                            const initialSl = pos.initialSl || pos.sl;
                            if (pos.direction === 'LONG' && pos.entry > initialSl && initialSl > 0) {
                                rMultiple = (currentPrice - pos.entry) / (pos.entry - initialSl);
                            } else if (pos.direction === 'SHORT' && initialSl > pos.entry && initialSl > 0) {
                                rMultiple = (pos.entry - currentPrice) / (initialSl - pos.entry);
                            }
                        }

                        const rText = `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)} R`;
                        const reachedTarget = pos.tp > 0 && (
                            (pos.direction === 'LONG' && currentPrice >= pos.tp) ||
                            (pos.direction === 'SHORT' && currentPrice <= pos.tp)
                        );
                        const reachedStop = pos.sl > 0 && (
                            (pos.direction === 'LONG' && currentPrice <= pos.sl) ||
                            (pos.direction === 'SHORT' && currentPrice >= pos.sl)
                        );

                        const banner = evaluateActionBanner({
                            engineRec: pos.engineRec,
                            reachedStop,
                            reachedTarget,
                            suggestedStop: pos.suggestedStop,
                            anaReason: pos.anaReason,
                            direction: pos.direction,
                            sl: pos.sl,
                            tp: pos.tp,
                            rMultiple,
                            rText,
                            effortType: pos.effortType
                        });

                        return {
                            ...pos,
                            currentPrice,
                            pnlUsdt,
                            pnlPercent,
                            rMultiple,
                            rResult: rText,
                            ...banner
                        };
                    }
                } catch (_) {}
                return pos;
            }));

            // Filter out any positions that were closed while async fetch was in-flight
            const validUpdated = updated.filter(p => currentPositionIds.has(p.id));
            if (hasUpdates) {
                positions = validUpdated;
                openPositions.set(validUpdated);
                totalPnlUsdt = positions.reduce((acc, curr) => acc + curr.pnlUsdt, 0);
                totalR = positions.reduce((acc, curr) => acc + curr.rMultiple, 0);
                if (totalCapital > 0) {
                    totalPnlPercent = (totalPnlUsdt / totalCapital) * 100;
                }
            }
        } finally {
            isUpdatingLivePrices = false;
        }
    }

    onMount(() => {
        loadLivePositions();
        startLiveTicker();
    });

    onDestroy(() => {
        stopLiveTicker();
    });

    let isCloseModalOpen = false;
    let selectedClosePosition = null;

    export function addPosition(newPos) {
        positions = [newPos, ...positions];
        openPositions.update(p => [newPos, ...(p || [])]);
    }

    function handleOpenCloseModal(pos) {
        selectedClosePosition = pos;
        isCloseModalOpen = true;
    }

    function handleCloseModal() {
        isCloseModalOpen = false;
        selectedClosePosition = null;
    }

    async function handleConfirmClose(pos, exitPrice) {
        if (pos.rawId) {
            const res = await closePositionApi(pos.rawId, exitPrice, 'MANUAL_DASHBOARD_CLOSE');
            if (!res.success) {
                console.warn('Backend close failed:', res.error);
            }
        }
        removePositionMeta(pos.symbol);
        positions = positions.filter(p => p.id !== pos.id);
        openPositions.update(list => (list || []).filter(p => {
            const pRaw = p.rawId ?? (typeof p.id === 'number' ? p.id : parseInt(String(p.id).replace('pos-', '')));
            const targetRaw = pos.rawId ?? (typeof pos.id === 'number' ? pos.id : parseInt(String(pos.id).replace('pos-', '')));
            return pRaw && targetRaw ? pRaw !== targetRaw : p.id !== pos.id;
        }));
        await loadLivePositions();
    }

    let updatingStopId = null;

    async function handleApplySuggestedStop(pos) {
        if (!pos.rawId || !pos.suggestedStop || updatingStopId) return;
        const confirmMsg = `Xác nhận dời Stop-loss của ${cleanSymbol(pos.symbol)} từ $${formatPrice(pos.sl)} sang $${formatPrice(pos.suggestedStop)}?`;
        if (!window.confirm(confirmMsg)) return;

        updatingStopId = pos.id;
        try {
            const res = await updatePositionStopApi(
                pos.rawId,
                pos.suggestedStop,
                pos.currentPrice,
                pos.stopAction || pos.engineRec || 'TIGHTEN_STOP'
            );
            if (res.success) {
                pos.sl = pos.suggestedStop;
                pos.suggestedStop = null;
                await loadLivePositions();
            } else {
                alert(`Cập nhật Stop thất bại: ${res.error || 'Lỗi không xác định'}`);
            }
        } catch (e) {
            alert(`Lỗi kết nối: ${e.message}`);
        } finally {
            updatingStopId = null;
        }
    }
</script>

<div style="display: flex; flex-direction: column; gap: 1.25rem;">
    <!-- Compact Summary Header -->
    <div class="card pos-summary-card">
        <div class="pos-summary-left">
            <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">
                Vị Thế Đang Mở ({positions.length})
            </span>
            {#if positions.length > 0}
                <div class="pos-badges-wrap">
                    <span class="badge {totalPnlUsdt >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.825rem; padding: 0.25rem 0.6rem; font-family: var(--font-mono);">
                        Lợi Nhuận: {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}% ({totalPnlUsdt >= 0 ? '+' : ''}${totalPnlUsdt.toFixed(2)})
                    </span>
                    <span class="badge badge-emerald" style="font-size: 0.825rem; padding: 0.25rem 0.6rem; font-family: var(--font-mono);">
                        {totalR >= 0 ? '+' : ''}{totalR.toFixed(2)} R
                    </span>
                    <span class="badge badge-neutral" style="font-size: 0.8rem; font-family: var(--font-mono);">
                        Tổng Ký Quỹ: ${totalCapital.toFixed(2)}{#if totalNotional > totalCapital} (Quy Mô: ${totalNotional.toFixed(2)}){/if}
                    </span>
                </div>
            {/if}
        </div>
        <div class="pos-summary-actions">
            <button class="btn btn-outline" on:click={loadLivePositions} disabled={isLoading} style="padding: 0.4rem 0.85rem; font-size: 0.825rem;">
                {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
            <button class="btn" on:click={() => onOpenOrderModal('', 'LONG', '', '', '')} style="padding: 0.4rem 0.95rem; font-size: 0.825rem;">
                + Mở vị thế
            </button>
        </div>
    </div>

    <!-- Active Positions List -->
    <div id="positions-list">
        {#each positions as pos (pos.id)}
            <div class="position-card" data-status={pos.status}>
                <div class="position-header">
                    <div class="position-title-group">
                        <span class="station-symbol">{cleanSymbol(pos.symbol)}</span>
                        {#if pos.leverage && pos.leverage > 1}
                            <span class="badge badge-neutral" style="font-family: var(--font-mono); font-weight: 800; border: 1px solid var(--border-card); background: #f1f5f9;">{pos.leverage}x</span>
                        {/if}
                        <span class="badge {pos.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">{pos.direction === 'SHORT' ? 'BÁN' : 'MUA'}</span>
                        <span class="badge {pos.statusClass}">{pos.statusLabel}</span>
                        {#if pos.policyId}
                            <span class="badge badge-neutral">Chiến Lược: {pos.policyId}</span>
                        {/if}
                    </div>
                    <button class="btn {pos.actionBtnClass || (pos.isSell ? 'btn-rose' : 'btn-outline')}" style="font-size: 0.825rem; padding: 0.35rem 0.85rem;" on:click={() => handleOpenCloseModal(pos)}>
                        {pos.actionBtnText}
                    </button>
                </div>

                <div class="position-metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
                    <div class="p-metric-item">
                        <span class="p-metric-label">Giá Vào</span>
                        <span class="p-metric-val">${formatPrice(pos.entry)}</span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Giá Hiện Tại</span>
                        <span class="p-metric-val {pos.pnlPercent >= 0 ? 'text-emerald' : 'text-rose'}">
                            ${formatPrice(pos.currentPrice)}
                        </span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Cắt Lỗ</span>
                        <span class="p-metric-val text-rose">${formatPrice(pos.sl)}</span>
                        {#if pos.suggestedStop && Math.abs(pos.suggestedStop - pos.sl) > 0.00001}
                            <div style="margin-top: 4px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                                <span style="font-size: 0.72rem; color: var(--amber); font-weight: 700;" title="Khuyến nghị dời Stop-loss">
                                    ➔ Đề xuất: ${formatPrice(pos.suggestedStop)}
                                </span>
                                <button
                                    class="btn btn-outline"
                                    style="padding: 0.15rem 0.45rem; font-size: 0.68rem; line-height: 1; border-color: var(--amber); color: var(--amber); border-radius: 4px; font-weight: 700; cursor: pointer;"
                                    disabled={updatingStopId === pos.id}
                                    on:click|stopPropagation={() => handleApplySuggestedStop(pos)}
                                    title="Lưu Stop-loss đề xuất vào hệ thống"
                                >
                                    {updatingStopId === pos.id ? 'Đang lưu...' : 'Áp dụng'}
                                </button>
                            </div>
                        {/if}
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Chốt Lời</span>
                        <span class="p-metric-val text-emerald">${formatPrice(pos.tp)}</span>
                    </div>

                    {#if pos.leverage && pos.leverage > 1}
                        <div class="p-metric-item">
                            <span class="p-metric-label" style="color: var(--amber);">Giá Thanh Lý ({pos.leverage}x)</span>
                            <span class="p-metric-val text-amber">
                                ${formatPrice(pos.liqPrice)}
                            </span>
                        </div>
                    {/if}

                    <div class="p-metric-item">
                        <span class="p-metric-label">Lợi Nhuận</span>
                        <span class="p-metric-val {pos.pnlPercent >= 0 ? 'text-emerald' : 'text-rose'}">
                            {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            <span style="font-size: 0.75rem; opacity: 0.8;">
                                ({pos.pnlUsdt >= 0 ? '+' : ''}${pos.pnlUsdt.toFixed(2)})
                            </span>
                        </span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Hiệu Suất R</span>
                        <span class="p-metric-val {pos.rMultiple >= 0 ? 'text-emerald' : 'text-rose'}">
                            {pos.rResult}
                        </span>
                    </div>
                </div>

                <!-- Strategic Action Banner -->
                <div style="margin-top: 0.85rem; padding: 0.85rem 1.15rem; background: {pos.bannerBg || (pos.isSell ? 'var(--phase-markdown-bg)' : 'var(--phase-markup-bg)')}; border: 1px solid {pos.bannerBorder || (pos.isSell ? 'var(--phase-markdown-border)' : 'var(--phase-markup-border)')}; border-radius: 8px;">
                    <div style="font-size: 0.9rem; font-weight: 800; color: {pos.bannerColor || (pos.isSell ? 'var(--rose)' : 'var(--emerald)')};">
                        {pos.actionTitle}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; line-height: 1.45;">
                        {pos.actionDesc}
                    </div>
                </div>

                {#if pos.entryTime}
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem; font-family: var(--font-mono); display: flex; gap: 0.85rem; flex-wrap: wrap;">
                        <span>Thời gian mở: <strong>{formatVNTime(pos.entryTime)}</strong></span>
                        <span>Ký quỹ: <strong class="text-emerald">${pos.margin.toFixed(2)}</strong></span>
                        {#if pos.leverage && pos.leverage > 1}
                            <span>Đòn bẩy: <strong>{pos.leverage}x</strong></span>
                            <span>Quy mô vị thế: <strong>${pos.notional.toFixed(2)}</strong></span>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}

        {#if positions.length === 0}
            <div class="card" style="text-align: center; color: var(--text-muted); padding: 4rem 1.5rem;">
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.4rem;">
                    Chưa có vị thế mở nào
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 480px; margin: 0 auto; line-height: 1.5;">
                    Hệ thống đang giám sát 15 coin theo chu kỳ Wyckoff. Khi xuất hiện điểm vào phù hợp hoặc bạn mở vị thế thủ công, trạng thái sẽ được theo dõi realtime tại đây.
                </div>
            </div>
        {/if}
    </div>
</div>

<ClosePositionModal 
    isOpen={isCloseModalOpen} 
    position={selectedClosePosition} 
    onClose={handleCloseModal} 
    onConfirmClose={handleConfirmClose} 
/>

<style>
    .pos-summary-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
    }
    .pos-summary-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .pos-badges-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
    }
    .pos-summary-actions {
        display: flex;
        gap: 0.5rem;
    }

    @media (max-width: 640px) {
        .pos-summary-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
            padding: 1rem;
        }
        .pos-summary-actions {
            width: 100%;
        }
        .pos-summary-actions button {
            flex: 1;
            justify-content: center;
        }
    }
</style>
