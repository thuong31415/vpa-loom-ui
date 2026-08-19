export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const REMOTE_API_HOST = 'http://103.167.88.197:8081';

// Supported Universe Coins
export const UNIVERSE_COINS = [
    "ETHUSDT", "BTCUSDT", "SOLUSDT", "SUIUSDT", "UNIUSDT",
    "LINKUSDT", "ZECUSDT", "LDOUSDT", "NEARUSDT", "BNBUSDT", "TAOUSDT", "ADAUSDT"
];

/**
 * Fetch detailed analysis for a single symbol (e.g., ETH, BTC, SOL)
 * GET /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=500
 */
export async function fetchAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 500) {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const url = `${BASE_URL}/api/v1/analysis?symbol=${encodeURIComponent(cleanSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            return { success: true, data, source: 'LIVE_API' };
        } else {
            return { success: false, error: `API Error (${response.status}): ${response.statusText}` };
        }
    } catch (err) {
        console.warn(`Error fetching analysis for ${cleanSymbol}:`, err);
        return { success: false, error: err.message };
    }
}

/**
 * Hydrate and resolve analysis for a single symbol (executes missing prerequisites if needed)
 * POST /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=500
 */
export async function resolveAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 500) {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const url = `${BASE_URL}/api/v1/analysis?symbol=${encodeURIComponent(cleanSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            return { success: true, data, source: 'LIVE_API' };
        }
    } catch (err) {
        console.warn(`Error resolving analysis for ${cleanSymbol}:`, err);
    }
    return fetchAnalysis(cleanSymbol, interval, limit);
}

/**
 * Fetch market scanner candidates across all 12 universe coins
 * POST /api/v1/analysis/scan?interval=4h&limit=500
 */
export async function fetchScanCandidates(interval = '4h', limit = 500) {
    const url = `${BASE_URL}/api/v1/analysis/scan?interval=${encodeURIComponent(interval)}&limit=${limit}`;

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        if (response.status === 405) {
            response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
        }
        if (response.ok) {
            const data = await response.json();
            return { data, source: 'LIVE_API', success: true };
        }
    } catch (err) {
        console.warn('Backend /scan API unavailable:', err);
    }

    return {
        data: {
            interval: "4h",
            limit: 500,
            latest_evidence_cutoff: new Date().toISOString(),
            scanned_count: UNIVERSE_COINS.length,
            available_count: UNIVERSE_COINS.length,
            actionable_count: 0,
            no_trade_count: UNIVERSE_COINS.length,
            universe: UNIVERSE_COINS,
            candidates: [],
            failures: []
        },
        source: 'OFFLINE_FALLBACK',
        success: false
    };
}

/**
 * Fetch open position for a symbol or all symbols
 * GET /api/v1/positions?symbol=ETHUSDT
 */
export async function fetchPositionsApi(symbol = 'ETHUSDT') {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    try {
        const response = await fetch(`${BASE_URL}/api/v1/positions?symbol=${encodeURIComponent(cleanSymbol)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const text = await response.text();
            if (!text || text.trim() === '') {
                return { success: true, data: null };
            }
            const data = JSON.parse(text);
            return { success: true, data };
        }
    } catch (err) {
        console.warn('Backend GET /api/v1/positions unavailable:', err);
    }
    return { success: false, data: null };
}

/**
 * Create a manual open position
 * POST /api/v1/positions
 */
export async function createPositionApi(orderData) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/positions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({
                symbol: orderData.symbol,
                interval: orderData.interval || '4h',
                direction: orderData.direction || 'LONG',
                entryPrice: parseFloat(orderData.entry),
                quoteAmount: parseFloat(orderData.risk || 200)
            })
        });
        if (response.ok) {
            const resJson = await response.json();
            return { success: true, data: resJson };
        }
    } catch (err) {
        console.warn('Backend POST /api/v1/positions error:', err);
    }
    return { success: false };
}

/**
 * Close an existing position
 * POST /api/v1/positions/{id}/close
 */
export async function closePositionApi(id, exitPrice, reason = 'MANUAL_CLOSE') {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/positions/${id}/close`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({
                exitPrice: parseFloat(exitPrice),
                reason: reason
            })
        });
        if (response.ok) {
            const resJson = await response.json();
            return { success: true, data: resJson };
        }
    } catch (err) {
        console.warn(`Backend POST /api/v1/positions/${id}/close error:`, err);
    }
    return { success: false };
}

/**
 * Account Summary API (with local fallback if endpoint not implemented on backend)
 * GET /api/v1/account/summary
 */
export async function fetchAccountSummaryApi() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/account/summary`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        }
    } catch (err) {
        // Fallback gracefully
    }
    return { success: false };
}

/**
 * Account Transactions API
 * GET /api/v1/account/transactions
 */
export async function fetchCapitalTransactionsApi() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/account/transactions`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        }
    } catch (err) {
        // Fallback gracefully
    }
    return { success: false, data: [] };
}

/**
 * Create Capital Transaction API
 * POST /api/v1/account/transactions
 */
export async function createCapitalTransactionApi(type, amount, note) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/account/transactions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({
                type,
                amount: parseFloat(amount),
                note
            })
        });
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        }
    } catch (err) {
        console.warn('Backend POST /api/v1/account/transactions error:', err);
    }
    return { success: false };
}

// -------------------------------------------------------------
// Human-Friendly Vietnamese Translators for Wyckoff / VPA Domain
// -------------------------------------------------------------

export function translateTrend(trend) {
    if (!trend) return 'Chưa xác định';
    switch (trend.toUpperCase()) {
        case 'BULLISH': return '📈 Xu hướng Tăng (Bullish)';
        case 'BEARISH': return '📉 Xu hướng Giảm (Bearish)';
        case 'MIXED': return '↔️ Đi ngang / Hỗn hợp (Mixed)';
        case 'MIXED_BULLISH': return '↗️ Hỗn hợp nghiêng Tăng';
        case 'MIXED_BEARISH': return '↘️ Hỗn hợp nghiêng Giảm';
        default: return trend;
    }
}

export function translateStructureBreak(msb) {
    if (!msb || msb === 'NO_CONFIRMED_BREAK' || msb.startsWith('NOT_DETECTED')) {
        return 'Chưa có Phá vỡ Cấu trúc (No MSB)';
    }
    if (msb.includes('BULLISH')) return '⚡ Phá vỡ Cấu trúc Tăng (Bullish MSB)';
    if (msb.includes('BEARISH')) return '⚡ Phá vỡ Cấu trúc Giảm (Bearish MSB)';
    return msb;
}

export function translateLocation(loc) {
    if (!loc) return 'Chưa xác định';
    switch (loc.toUpperCase()) {
        case 'AT_SUPPORT': return '🛡️ Tại Vùng Hỗ Trợ (Support)';
        case 'AT_RESISTANCE': return '🚧 Tại Vùng Kháng Cự (Resistance)';
        case 'BETWEEN_SUPPORT_AND_RESISTANCE': return '⚖️ Lưng chừng giữa Hỗ trợ & Kháng cự';
        case 'ABOVE_RESISTANCE': return '🚀 Đột phá trên Kháng cự';
        case 'BELOW_SUPPORT': return '⚠️ Thủng dưới Hỗ trợ';
        default: return loc;
    }
}

export function translateEffort(type) {
    if (!type) return 'Bình thường';
    switch (type.toUpperCase()) {
        case 'HIGH_EFFORT_LOW_RESULT':
            return 'Volume Cao nhưng Nến Nhỏ (Lực cản / Hấp thụ mạnh)';
        case 'HIGH_EFFORT_HIGH_RESULT':
            return 'Volume Cao + Nến Lớn (Đẩy giá quyết liệt)';
        case 'LOW_EFFORT_HIGH_RESULT':
            return 'Volume Thấp nhưng Nến Lớn (Cung/Cầu cạn kiệt)';
        case 'LOW_EFFORT_LOW_RESULT':
            return 'Volume Thấp + Nến Nhỏ (Thị trường trầm lắng)';
        default:
            return type;
    }
}

export function translateDecisionStatus(status) {
    if (!status) return 'Chưa rõ';
    switch (status.toUpperCase()) {
        case 'PROPOSED': return '🟢 ĐÃ CÓ SETUP HỢP LỆ';
        case 'WAITING_CONFIRMATION': return '⏳ Đang Chờ Xác Nhận Tín Hiệu';
        case 'REJECTED': return '⏸️ Tạm Dừng / Chưa Đủ Điều Kiện';
        default: return status;
    }
}

export function translateAction(action) {
    if (!action) return { text: 'CHƯA CÓ LỆNH', class: 'badge-neutral' };
    switch (action.toUpperCase()) {
        case 'BUY_READY':
            return { text: '🟢 SẴN SÀNG MUA (LONG)', class: 'badge-emerald' };
        case 'SHORT_READY':
            return { text: '🔴 SẴN SÀNG BÁN (SHORT)', class: 'badge-rose' };
        case 'NO_TRADE':
        default:
            return { text: '⏸️ QUAN SÁT (NO TRADE)', class: 'badge-neutral' };
    }
}

export function getFriendlyWyckoffTitle(policyId, direction) {
    if (policyId === 'SC_SPRING_RECOVERY_V1') return 'Wyckoff Spring Phase C — Bẫy dụ bán & gom hàng';
    if (policyId === 'SHORT_BREAK_CONTINUATION_V1') return 'Wyckoff Breakdown Phase D — Sập tiếp diễn phá hỗ trợ';
    if (policyId === 'SC_MARKDOWN_RECOVERY_V1') return 'Wyckoff Markdown Retest — Chốt lời nhịp rũ hàng';
    if (policyId === 'POST_BREAK_RETEST_V2') return 'Retest Vùng Phá Vỡ — Kiểm tra lại cản';
    if (policyId === 'RANGE_BREAK_IMPULSE_V1') return 'Phá vỡ biên Range tích lũy — Momentum nổ Volume';
    return direction === 'LONG' ? 'Setup Mua Tích Lũy Wyckoff' : 'Setup Bán Phân Phối Wyckoff';
}

export function getFriendlyVPADesc(candidate) {
    const vol = candidate?.analysis?.volume?.relative_volume || 2.0;
    const effort = candidate?.analysis?.volume?.effort_type;
    const support = candidate?.analysis?.trade_safe_support?.lower || 0.6678;
    
    if (effort === 'HIGH_EFFORT_LOW_RESULT') {
        return `"Khối lượng bán tăng cao (gấp ${vol.toFixed(2)} lần trung bình) nhưng giá không thể thủng vùng hỗ trợ $${support}. Lực bán bị cá voi hấp thụ hoàn toàn (HIGH_EFFORT_LOW_RESULT), xác nhận bẫy dụ Short và sẵn sàng cho đà tăng."`;
    }
    return `"Nguồn cung kiệt sức ở chân sóng tích lũy, khối lượng nén chặt ở vùng cản an toàn, mở ra cơ hội giao dịch với tỷ lệ R:R cao."`;
}
