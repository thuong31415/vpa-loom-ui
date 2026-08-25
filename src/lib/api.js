export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const REMOTE_HOSTS = [
    'http://103.167.88.197:8081'
];
export const REMOTE_API_HOST = REMOTE_HOSTS[0];

// Supported Universe Coins
export const UNIVERSE_COINS = [
    "ETHUSDT", "BTCUSDT", "SOLUSDT", "SUIUSDT", "UNIUSDT",
    "LINKUSDT", "ZECUSDT", "LDOUSDT", "NEARUSDT", "BNBUSDT",
    "PEPEUSDT", "TAOUSDT", "ADAUSDT", "ENAUSDT", "ZKUSDT"
];

/**
 * Robust Multi-Target JSON Fetcher:
 * Automatically rotates across candidate endpoints:
 * 1. Direct Backend API hosts (bypasses static Caddy 405 Method Not Allowed)
 * 2. Relative reverse proxy path
 * 3. Handles non-2xx (404, 405, 502) by trying the next target seamlessly
 */
async function safeJsonFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...(options.headers || {})
    };

    const fetchOptions = {
        cache: 'no-store',
        ...options,
        headers: defaultHeaders
    };

    // Candidate URLs to try in order
    const candidates = [];
    if (BASE_URL) {
        candidates.push(`${BASE_URL}${endpoint}`);
    }
    // Direct remote hosts (CORS-enabled backend ports)
    REMOTE_HOSTS.forEach(host => {
        candidates.push(`${host}${endpoint}`);
    });
    // Relative fallback
    candidates.push(endpoint);

    let lastStatus = 0;
    let lastError = null;

    for (const targetUrl of candidates) {
        try {
            const response = await fetch(targetUrl, fetchOptions);
            lastStatus = response.status;
            
            if (response.status === 204 || response.status === 205) {
                return { ok: true, data: null, status: response.status, url: targetUrl };
            }
            if (!response.ok) {
                // If 405 Method Not Allowed, 404, or 502, try next candidate
                console.warn(`Target ${targetUrl} returned status ${response.status}, trying next candidate...`);
                continue;
            }
            const text = await response.text();
            if (!text || text.trim() === '') {
                return { ok: true, data: null, status: response.status, url: targetUrl };
            }
            if (text.startsWith('{') || text.startsWith('[')) {
                return { ok: true, data: JSON.parse(text), status: response.status, url: targetUrl };
            }
        } catch (err) {
            console.warn(`Target ${targetUrl} failed with error:`, err.message);
            lastError = err;
        }
    }

    return { 
        ok: false, 
        status: lastStatus, 
        error: lastError?.message || `Không thể kết nối Backend API (Mã lỗi: ${lastStatus || 'Network'})` 
    };
}

/**
 * Fetch detailed analysis for a single symbol (e.g., ETH, BTC, SOL)
 * GET /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=720
 */
export async function fetchAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 720) {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const endpoint = `/api/v1/analysis?symbol=${encodeURIComponent(cleanSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}&_t=${Date.now()}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data, source: res.source };
    }
    return { success: false, error: res.error || 'Lỗi kết nối API phân tích' };
}

/**
 * Fetch live ticker price directly from Binance public API
 * GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
 */
export async function fetchBinanceLivePrice(symbol = 'BTCUSDT') {
    try {
        const raw = (symbol || 'BTCUSDT').trim().toUpperCase();
        const cleanSym = raw.endsWith('USDT') ? raw : `${raw}USDT`;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSym}`, {
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const price = parseFloat(json.price);
        return { ok: true, price: isNaN(price) ? null : price };
    } catch (err) {
        return { ok: false, price: null, error: err.message };
    }
}

/**
 * Hydrate and resolve analysis for a single symbol
 * GET /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=720
 */
export async function resolveAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 720) {
    return fetchAnalysis(symbol, interval, limit);
}

/**
 * Fetch market scanner candidates across all 12 universe coins
 * GET /api/v1/analysis/scan?interval=4h&limit=720
 */
export async function fetchScanCandidates(interval = '4h', limit = 720) {
    const endpoint = `/api/v1/analysis/scan?interval=${encodeURIComponent(interval)}&limit=${limit}&_t=${Date.now()}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok && res.data) {
        return { data: res.data, source: res.source, success: true };
    }

    return {
        data: {
            interval: "4h",
            limit: 360,
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
 * Fetch open position for a symbol
 * GET /api/v1/positions?symbol=ETHUSDT
 */
export async function fetchPositionsApi(symbol = 'ETHUSDT') {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const endpoint = `/api/v1/positions?symbol=${encodeURIComponent(cleanSymbol)}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false, data: null };
}

/**
 * Fetch all open positions across the universe
 * GET /api/v1/positions/open
 */
export async function fetchOpenPositionsApi() {
    const res = await safeJsonFetch('/api/v1/positions/open');
    if (res.ok && Array.isArray(res.data)) {
        return { success: true, data: res.data };
    }
    // Targeted fallback: check priority coins without flooding server connections
    const priorityCoins = ['LINKUSDT', 'ETHUSDT', 'BTCUSDT', 'SOLUSDT'];
    const results = [];
    for (const sym of priorityCoins) {
        const r = await fetchPositionsApi(sym);
        if (r.success && r.data && r.data.id) {
            results.push(r.data);
        }
    }
    return { success: true, data: results };
}

/**
 * Create a manual open position
 * POST /api/v1/positions
 */
export async function createPositionApi(orderData) {
    const endpoint = '/api/v1/positions';
    const body = JSON.stringify({
        symbol: orderData.symbol,
        interval: orderData.interval || '4h',
        direction: orderData.direction || 'LONG',
        entryPrice: parseFloat(orderData.entry),
        quoteAmount: parseFloat(orderData.risk || 200)
    });

    const res = await safeJsonFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });

    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Close an active position
 * POST /api/v1/positions/{id}/close
 */
export async function closePositionApi(id, exitPrice, reason = 'MANUAL_CLOSE') {
    const endpoint = `/api/v1/positions/${id}/close`;
    const body = JSON.stringify({
        exitPrice: parseFloat(exitPrice),
        reason
    });

    const res = await safeJsonFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });

    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Fetch closed trade history from PostgreSQL database
 * GET /api/v1/positions/history?limit=50
 */
export async function fetchPositionHistoryApi(limit = 50) {
    const endpoint = `/api/v1/positions/history?limit=${limit}`;
    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
        return { success: true, data: res.data };
    }
    return { success: false, data: [] };
}

/**
 * Fetch Capital Account Summary API
 * GET /api/v1/account/summary
 */
export async function fetchAccountSummaryApi() {
    const res = await safeJsonFetch('/api/v1/account/summary', { method: 'GET' });
    if (res.ok && res.data) {
        return { success: true, data: res.data };
    }
    return { success: false, data: null };
}

export async function fetchCapitalTransactionsApi(limit = 50) {
    const res = await safeJsonFetch(`/api/v1/account/transactions?limit=${limit}`, { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
        return { success: true, data: res.data };
    }
    return { success: false, data: [] };
}

/**
 * Create Capital Transaction API
 * POST /api/v1/account/transactions
 */
export async function createCapitalTransactionApi(type, amount, note) {
    const cleanType = type === 'WITHDRAWAL' ? 'WITHDRAW' : type;
    const res = await safeJsonFetch('/api/v1/account/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: cleanType, amount: parseFloat(amount), note })
    });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Clean Symbol name by stripping USDT suffix:
 * ETHUSDT -> ETH, BTCUSDT -> BTC
 */
export function cleanSymbol(sym) {
    if (!sym) return '';
    return String(sym).replace(/USDT$/i, '').trim();
}

/**
 * Format Price with dynamic decimal places:
 * - >= 1000: 2 decimals ($65,420.50)
 * - >= 1: 2 to 4 decimals ($2,450.25, $0.6756)
 * - < 1: 4 to 6 decimals ($0.008650, $0.000012)
 */
export function formatPrice(val) {
    if (val === null || val === undefined || val === '') return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return String(val);
    if (num >= 1000) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (num >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } else if (num >= 0.0001) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    } else {
        return num.toFixed(8);
    }
}

/**
 * Format timestamp to Vietnam Time (UTC+7):
 * Example: 2026-08-21 19:13
 */
export function formatVNTime(val) {
    if (!val) return '—';
    try {
        const d = (typeof val === 'string' && !val.endsWith('Z') && !val.includes('+')) 
            ? new Date(`${val}Z`) 
            : new Date(val);
        if (isNaN(d.getTime())) return String(val);

        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(d);

        const getPart = (type) => parts.find(p => p.type === type)?.value || '';
        return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}`;
    } catch (e) {
        return String(val);
    }
}

// -------------------------------------------------------------
// Human-Friendly Vietnamese Translators for Wyckoff / VPA Domain
// -------------------------------------------------------------

export function translateTrend(trend) {
    if (!trend || trend === 'UNAVAILABLE') return 'Chưa xác định';
    switch (trend.toUpperCase()) {
        case 'BULLISH': return 'Tăng';
        case 'BEARISH': return 'Giảm';
        case 'MIXED': return 'Đi ngang';
        case 'MIXED_BULLISH': return 'Nghiêng Tăng';
        case 'MIXED_BEARISH': return 'Nghiêng Giảm';
        case 'CONFLICTING': return 'Xung đột đa khung';
        default: return trend;
    }
}

export function translateStructureBreak(msb) {
    if (!msb || msb === 'NO_CONFIRMED_BREAK' || msb === 'UNAVAILABLE' || msb.startsWith('NOT_DETECTED')) {
        return 'Chưa Phá Vỡ';
    }
    if (msb.includes('UP') || msb.includes('BULLISH')) return 'Phá Vỡ Tăng';
    if (msb.includes('DOWN') || msb.includes('BEARISH')) return 'Phá Vỡ Giảm';
    return msb;
}

export function translateLocation(loc) {
    if (!loc) return 'Chưa xác định';
    switch (loc.toUpperCase()) {
        case 'AT_SUPPORT': return 'Tại Hỗ Trợ';
        case 'AT_RESISTANCE': return 'Tại Kháng Cự';
        case 'BETWEEN_SUPPORT_AND_RESISTANCE': return 'Giữa 2 Cản';
        case 'ABOVE_RESISTANCE': return 'Phá Trên Kháng Cự';
        case 'BELOW_SUPPORT': return 'Thủng Dưới Hỗ Trợ';
        default: return loc;
    }
}

export function translateCyclePhase(phase) {
    if (!phase) return 'Chưa xác định';
    switch (phase.toUpperCase()) {
        case 'ACCUMULATION': return 'Tích Lũy';
        case 'MARKUP': return 'Đẩy Giá';
        case 'DISTRIBUTION': return 'Phân Phối';
        case 'MARKDOWN': return 'Giảm Giá';
        case 'UNRESOLVED': return 'Chưa Chốt Pha';
        default: return phase;
    }
}

export function translateCycleStage(stage) {
    if (!stage) return '';
    switch (stage.toUpperCase()) {
        case 'EARLY': return 'Giai Đoạn Đầu';
        case 'MIDDLE':
        case 'MID': return 'Giai Đoạn Giữa';
        case 'LATE': return 'Giai Đoạn Cuối';
        case 'MATURE': return 'Trưởng Thành';
        case 'TRANSITION': return 'Chuyển Tiếp';
        default: return stage;
    }
}

export function translateStrength(strength) {
    if (!strength) return '';
    switch (strength.toUpperCase()) {
        case 'CONFIRMED': return 'Đã Xác Nhận';
        case 'PROVISIONAL': return 'Tạm Thời';
        default: return strength;
    }
}

export function translateCycleReason(reason) {
    if (!reason) return '';
    switch (reason.toUpperCase()) {
        case 'ACCUMULATION_RESOLVED_INTO_MARKUP': return 'Tích lũy hoàn tất ➔ Vào pha Đẩy giá';
        case 'DISTRIBUTION_RESOLVED_INTO_MARKDOWN': return 'Phân phối hoàn tất ➔ Vào pha Giảm giá';
        case 'TRANSITION_CONFIRMED': return 'Chuyển pha bứt phá xác nhận';
        case 'MARKDOWN_CONTINUATION': return 'Tiếp diễn xu hướng Giảm giá';
        case 'MARKUP_CONTINUATION': return 'Tiếp diễn xu hướng Đẩy giá';
        case 'CLIMAX_STOPPING_CONFIRMED': return 'Cao trào hãm đà xác nhận';
        case 'SPRING_RECLAIM_CONFIRMED': return 'Rũ bỏ & lấy lại hỗ trợ (Spring)';
        case 'UPTHRUST_REJECTION_CONFIRMED': return 'Bẫy tăng giá đỉnh (UTAD)';
        case 'STRUCTURE_AND_SEQUENCE_ALIGNED': return 'Cấu trúc & dòng tiền đồng thuận';
        case 'SEQUENCE_CHANGE_OF_CHARACTER': return 'Đổi tính chất xu hướng';
        case 'DIRECTIONAL_SEQUENCE_WITHOUT_STRUCTURE': return 'Dòng tiền có hướng (chưa bứt cản)';
        case 'BALANCE_AFTER_PRIOR_MARKDOWN': return 'Cân bằng hấp thụ sau đà giảm';
        case 'BALANCE_AFTER_PRIOR_MARKUP': return 'Cân bằng tích tụ sau đà tăng';
        case 'DETERMINISTIC_BALANCE_FALLBACK': return 'Cân bằng giằng co trong biên độ';
        case 'COMPLETE_ACCUMULATION_SEQUENCE': return 'Đầy đủ chuỗi tích lũy';
        case 'COMPLETE_DISTRIBUTION_SEQUENCE': return 'Đầy đủ chuỗi phân phối';
        case 'BREAKOUT_CONFIRMED': return 'Bứt phá kháng cự xác nhận';
        case 'BREAKDOWN_CONFIRMED': return 'Thủng đáy hỗ trợ xác nhận';
        case 'STAGE_ADVANCED': return 'Tiến trình giai đoạn hoàn tất';
        case 'CONFLICTING_TRANSITION_EVIDENCE': return 'Xung đột bằng chứng chuyển pha';
        case 'DISLOCATED_PRICE_ACTION': return 'Biến động lệch ngoài biên cấu trúc';
        default: return reason;
    }
}

export function translateSequencePattern(pattern) {
    if (!pattern) return '';
    switch (pattern.toUpperCase()) {
        case 'UP_CONTINUATION': return 'Tiếp Diễn Tăng';
        case 'DOWN_CONTINUATION': return 'Tiếp Diễn Giảm';
        case 'UP_REVERSAL': return 'Đảo Chiều Tăng';
        case 'DOWN_REVERSAL': return 'Đảo Chiều Giảm';
        case 'UP_MIXED': return 'Nghiêng Tăng Giằng Co';
        case 'DOWN_MIXED': return 'Nghiêng Giảm Giằng Co';
        case 'FLAT_MIXED': return 'Đi Ngang Giằng Co';
        case 'CONTINUATION_UP': return 'Tiếp Diễn Tăng';
        case 'CONTINUATION_DOWN': return 'Tiếp Diễn Giảm';
        case 'RANGE_BOUND': return 'Dao Động Trong Biên';
        default: return pattern;
    }
}

export function translateEffort(type) {
    if (!type) return 'Bình thường';
    switch (type.toUpperCase()) {
        case 'HIGH_EFFORT_LOW_RESULT':
            return 'Cá mập hấp thụ (Bẫy thanh khoản)';
        case 'HIGH_EFFORT_HIGH_RESULT':
            return 'Dòng tiền bùng nổ (Đẩy giá mạnh)';
        case 'LOW_EFFORT_HIGH_RESULT':
            return 'Cạn kiệt cản (Giá bay nhẹ)';
        case 'LOW_EFFORT_LOW_RESULT':
            return 'Thị trường cạn cung (Tích lũy)';
        default:
            return type;
    }
}

export function getFriendlyVPAStatus(effortResult) {
    if (!effortResult) {
        return {
            headline: 'Thanh khoản bình thường',
            detail: 'Volume ổn định quanh trung bình',
            badgeClass: 'text-secondary'
        };
    }
    const type = (effortResult.type || '').toUpperCase();
    const vol = effortResult.relative_volume || 1.0;
    const spread = effortResult.spread_atr || 1.0;
    const isCandidate = effortResult.status === 'CANDIDATE';
    const candleState = isCandidate ? '(Đang chạy)' : '(Đã đóng)';

    switch (type) {
        case 'HIGH_EFFORT_HIGH_RESULT':
            return {
                headline: 'Dòng tiền bùng nổ',
                detail: `Vol ${vol.toFixed(1)}x · Nến ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-emerald'
            };
        case 'HIGH_EFFORT_LOW_RESULT':
            return {
                headline: 'Cá mập hấp thụ',
                detail: `Vol ${vol.toFixed(1)}x · Nến nén ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-amber'
            };
        case 'LOW_EFFORT_HIGH_RESULT':
            return {
                headline: 'Giá lướt cạn cản',
                detail: `Vol ${vol.toFixed(1)}x · Nến ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-emerald'
            };
        case 'LOW_EFFORT_LOW_RESULT':
            return {
                headline: 'Thị trường cạn cung',
                detail: `Vol ${vol.toFixed(1)}x · Nến nén ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-secondary'
            };
        default:
            return {
                headline: `Thanh khoản ${vol.toFixed(1)}x trung bình`,
                detail: `Biên độ ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-secondary'
            };
    }
}

export function translateDecisionStatus(status) {
    if (!status) return 'Chưa rõ';
    switch (status.toUpperCase()) {
        case 'PROPOSED': return 'Có Kèo Hợp Lệ';
        case 'WAITING_CONFIRMATION': return 'Chờ Xác Nhận';
        case 'REJECTED': return 'Chưa Đủ Điều Kiện';
        default: return status;
    }
}

/**
 * Concise, actionable human-friendly Decision synthesizer.
 * Eliminates redundant metric dumps and explains clearly what the system is waiting for.
 */
export function formatDecisionExplanation(data) {
    if (!data) return 'Đang quan sát thị trường.';

    // 1. If actionable trade plan is available
    if (data.plan) {
        const dir = data.plan.direction === 'SHORT' ? 'Bán (Short)' : 'Mua (Long)';
        const setup = getFriendlyWyckoffTitle(data.plan.policy_id, data.plan.direction);
        const rr = data.plan.reward_risk ? data.plan.reward_risk.toFixed(2) : '2.0';
        return `Kích hoạt kế hoạch ${dir} với tỷ lệ R:R = ${rr}R. Đã xác nhận ${setup}.`;
    }

    // 2. If holding an open position
    if (data.position && data.position.status === 'OPEN') {
        const dir = data.position.direction || 'LONG';
        return `Đang nắm giữ vị thế ${dir}. Hệ thống theo dõi trailing stop và tín hiệu đảo chiều để tối ưu hóa lợi nhuận.`;
    }

    // 3. If in Waiting / No-Trade state
    const sup = data.key_levels?.support;
    const res = data.key_levels?.resistance;
    const isSupAvail = sup && sup.status === 'AVAILABLE';
    const isResAvail = res && res.status === 'AVAILABLE';

    // Case 3a: Price discovery / Open air above resistance
    if (!isResAvail && isSupAvail) {
        return 'Giá vừa bứt phá vào vùng không gian mở (Open Air). Chờ nhịp Retest hoặc tích lũy cạn cung để thiết lập điểm vào lệnh an toàn.';
    }

    // Case 3b: Price discovery / Dò đáy mới below support
    if (!isSupAvail && isResAvail) {
        return 'Giá đang dò đáy mới. Chờ xuất hiện nến bán cao trào và cấu trúc tái tích lũy trước khi xem xét mở vị thế.';
    }

    // Case 3c: Close to Support (distance <= 2.5%)
    if (isSupAvail && sup.distance_percent != null && sup.distance_percent <= 2.5) {
        return `Giá đang phản ứng gần vùng Hỗ Trợ ($${formatPrice(sup.lower)} – $${formatPrice(sup.upper)}). Chờ nến 4H đóng xác nhận tín hiệu cạn cung/đảo chiều để kích hoạt Long.`;
    }

    // Case 3d: Close to Resistance (distance <= 2.5%)
    if (isResAvail && res.distance_percent != null && res.distance_percent <= 2.5) {
        return `Giá đang tiếp cận vùng Kháng Cự ($${formatPrice(res.lower)} – $${formatPrice(res.upper)}). Chờ nến 4H đóng xác nhận tín hiệu từ chối giá hoặc cạn cầu để kích hoạt Short.`;
    }

    // Case 3e: Between Support and Resistance (Lưng chừng biên)
    if (isSupAvail && isResAvail) {
        return `Giá đang dao động lưng chừng giữa 2 cản ($${formatPrice(sup.upper)} – $${formatPrice(res.lower)}). Kiên nhẫn quan sát, không mở vị thế ở vùng giá bất lợi.`;
    }

    // Fallback: If backend provides a custom concise string or default
    return data.decision?.waiting_for || data.reason || 'Chưa đủ điều kiện kích hoạt setup Wyckoff. Chờ nến 4H đóng tiếp theo để xác nhận.';
}

export function translateAction(action) {
    if (!action) return { text: 'Chưa có lệnh', class: 'badge-neutral' };
    switch (action.toUpperCase()) {
        case 'BUY_READY':
            return { text: 'Mua (Long)', class: 'badge-emerald' };
        case 'SHORT_READY':
            return { text: 'Bán (Short)', class: 'badge-rose' };
        case 'NO_TRADE':
        default:
            return { text: 'Quan sát', class: 'badge-neutral' };
    }
}

export function getFriendlyWyckoffTitle(policyId, direction = 'LONG') {
    if (!policyId) return direction === 'LONG' ? 'Setup Mua Tích Lũy Wyckoff' : 'Setup Bán Phân Phối Wyckoff';
    
    switch (policyId.toUpperCase()) {
        case 'WYCKOFF_CLIMAX_BASE_ACCUMULATION_V1':
            return 'Wyckoff Schematic 2: Climax Base — Gom Hàng Đáy Cạn Cung (Springless)';
        case 'SC_SPRING_RECOVERY_V1':
        case 'SC_MARGINAL_SPRING_RECOVERY_V1':
            return 'Wyckoff Spring Phase C — Bẫy Rũ Bỏ & Gom Hàng (Spring Recovery)';
        case 'SC_SECONDARY_TEST_ABSORPTION_V1':
            return 'Wyckoff Secondary Test Phase B — Hấp Thụ Cung Đáy (ST Absorption)';
        case 'SC_TERMINAL_ABSORPTION_REVERSAL_V1':
            return 'Wyckoff Terminal Absorption — Đảo Chiều Hấp Thụ Cực Đại';
        case 'SC_MARKUP_RECOVERY_V2':
            return 'Wyckoff Markup Role Flip — Xác Nhận Đổi Vai Hỗ Trợ';
        case 'SC_MARKDOWN_RECOVERY_V1':
            return 'Wyckoff Markdown Retest — Chốt Lời Nhịp Rũ Hàng';
        case 'SHORT_BREAK_CONTINUATION_V1':
            return 'Wyckoff Breakdown Phase D — Sập Tiếp Diễn Phá Hỗ Trợ';
        case 'POST_BREAK_RETEST_V2':
            return 'Retest Vùng Phá Vỡ — Kiểm Tra Lại Cản (Post-Break Retest)';
        case 'POST_BREAK_LOW_SUPPLY_ACCEPTANCE_V1':
            return 'Wyckoff Post-Break Low Supply — Chấp Nhận Giá Cạn Cung';
        case 'RANGE_BREAK_IMPULSE_V1':
            return 'Phá Vỡ Biên Range Tích Lũy — Xung Lực Bùng Nổ Volume (RBI)';
        case 'RANGE_BREAK_CONTINUATION_V1':
            return 'Phá Vỡ Biên Range Tiếp Diễn — Mở Rộng Biên Độ Sóng';
        case 'DIRECTIONAL_OPEN_SURFACE_V1':
        case 'DIRECTIONAL_OPEN_SURFACE_ACCEPTANCE_V1':
            return 'Directional Open Surface — Bứt Phá Không Gian Mở (Khám Phá Giá)';
        case 'MICRO_SPRING_UPTHRUST_V1':
            return 'Micro Spring / Upthrust — Bẫy Thanh Khoản Khung Nhỏ';
        default:
            return direction === 'LONG' ? `Setup Mua Wyckoff (${policyId})` : `Setup Bán Wyckoff (${policyId})`;
    }
}

export function getFriendlyVPADesc(candidate) {
    const vol = candidate?.analysis?.market_state?.effort_result?.relative_volume 
        || candidate?.analysis?.volume?.relative_volume 
        || 1.5;
    const effort = candidate?.analysis?.market_state?.effort_result?.type 
        || candidate?.analysis?.volume?.effort_type;
    const support = candidate?.analysis?.key_levels?.support?.lower 
        || candidate?.analysis?.trade_safe_support?.lower 
        || 0;
    const resistance = candidate?.analysis?.key_levels?.resistance?.upper 
        || candidate?.analysis?.trade_safe_resistance?.upper 
        || 0;
    
    if (effort === 'HIGH_EFFORT_LOW_RESULT') {
        return `"Khối lượng giao dịch tăng cao (gấp ${vol.toFixed(2)}x SMA20) nhưng biên độ nến bị nén chặt. Lực đối ứng bị cá mập hấp thụ hoàn toàn (HIGH_EFFORT_LOW_RESULT), xác nhận bẫy thanh khoản và sẵn sàng cho nhịp đảo chiều."`;
    }
    if (effort === 'HIGH_EFFORT_HIGH_RESULT') {
        return `"Khối lượng bùng nổ (gấp ${vol.toFixed(2)}x SMA20) đồng pha với thân nến mở rộng quyết liệt (HIGH_EFFORT_HIGH_RESULT). Dòng tiền lớn tham gia xác nhận xu hướng bứt phá."`;
    }
    if (effort === 'LOW_EFFORT_HIGH_RESULT') {
        return `"Nguồn cung/cầu đối nghịch cạn kiệt hoàn toàn, giá di chuyển thanh thoát mà không cần nhiều khối lượng (LOW_EFFORT_HIGH_RESULT / Ease of Movement)."`;
    }
    return `"Cấu trúc nén chặt tại vùng cản trọng yếu ($${support ? formatPrice(support) : 'Support'} - $${resistance ? formatPrice(resistance) : 'Resistance'}), khối lượng kiểm định đạt chuẩn VPA, mở ra cơ hội giao dịch với tỷ lệ R:R tối ưu."`;
}
