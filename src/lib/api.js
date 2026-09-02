/**
 * API Service for vpa-loom-ui
 * Nối trực tiếp tới Backend Engine Go tại http://103.167.88.197:8081
 */

// BASE_URL endpoint mặc định nối trực tiếp tới VPS Go Engine 8081
export const BASE_URL = 'http://103.167.88.197:8081';

// Danh sách 15 Coin Universe theo dõi cốt lõi
export const UNIVERSE_COINS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LINKUSDT', 
    'UNIUSDT', 'SUIUSDT', 'NEARUSDT', 'ADAUSDT', 'LDOUSDT', 
    'TAOUSDT', 'PEPEUSDT', 'ZKUSDT', 'APTUSDT', 'AVAXUSDT'
];

export const REMOTE_API_HOST = 'http://103.167.88.197:8081';

// -------------------------------------------------------------
// 1. Core Market Analysis & Radar APIs
// -------------------------------------------------------------

export async function fetchAnalysis(symbol = 'BTCUSDT', interval = '4h', limit = 1000) {
    try {
        const url = `${BASE_URL}/api/v1/analysis?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || `HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        return { success: true, data };
    } catch (err) {
        console.warn(`[API] fetchAnalysis error for ${symbol}:`, err.message);
        return { success: false, error: err.message };
    }
}

export async function fetchScanCandidates() {
    try {
        const url = `${BASE_URL}/api/v1/scan/candidates`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        return { success: true, data };
    } catch (err) {
        console.warn('[API] fetchScanCandidates error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function fetchUniverseRadar(interval = '4h', limit = 1000) {
    const promises = UNIVERSE_COINS.map(async (symbol) => {
        try {
            const res = await fetchAnalysis(symbol, interval, limit);
            return {
                symbol,
                analysis: res.success ? res.data : null,
                error: res.success ? null : res.error
            };
        } catch (e) {
            return { symbol, analysis: null, error: e.message };
        }
    });

    return await Promise.all(promises);
}

// -------------------------------------------------------------
// 2. Realtime Binance Tickers & Prices
// -------------------------------------------------------------

export async function fetchBinanceLivePrice(symbol = 'BTCUSDT') {
    try {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
        const json = await res.json();
        return { ok: true, price: parseFloat(json.price) };
    } catch (err) {
        return { ok: false, price: null, error: err.message };
    }
}

export async function fetchBinanceUniverse24hTickers() {
    try {
        const symbolsParam = JSON.stringify(UNIVERSE_COINS);
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Binance 24h Ticker HTTP ${res.status}`);
        const data = await res.json();
        const map = {};
        if (Array.isArray(data)) {
            data.forEach(t => {
                map[t.symbol] = {
                    price: parseFloat(t.lastPrice),
                    priceChangePercent: parseFloat(t.priceChangePercent),
                    volume: parseFloat(t.volume),
                    quoteVolume: parseFloat(t.quoteVolume),
                    highPrice: parseFloat(t.highPrice),
                    lowPrice: parseFloat(t.lowPrice)
                };
            });
        }
        return { ok: true, data: map };
    } catch (err) {
        return { ok: false, error: err.message, data: {} };
    }
}

// -------------------------------------------------------------
// 3. Position & Capital Management APIs
// -------------------------------------------------------------

export async function fetchOpenPositionsApi() {
    try {
        const url = `${BASE_URL}/api/v1/positions?status=OPEN`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();
        return { success: true, data: json.data || json || [] };
    } catch (err) {
        console.warn('[API] fetchOpenPositionsApi error:', err.message);
        return { success: false, data: [], error: err.message };
    }
}

export async function fetchPositionsApi(status = 'ALL', limit = 100) {
    try {
        const statusQuery = status && status !== 'ALL' ? `&status=${status}` : '';
        const url = `${BASE_URL}/api/v1/positions?limit=${limit}${statusQuery}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { success: true, data: json.data || json || [] };
    } catch (err) {
        return { success: false, data: [], error: err.message };
    }
}

export async function fetchPositionHistoryApi(limit = 100) {
    try {
        const url = `${BASE_URL}/api/v1/positions?status=CLOSED&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { success: true, data: json.data || json || [] };
    } catch (err) {
        return { success: false, data: [], error: err.message };
    }
}

export async function createPositionApi({ symbol, direction, entry, sl, tp, risk = 200 }) {
    try {
        const payload = {
            symbol: symbol || 'BTCUSDT',
            direction: (direction || 'LONG').toUpperCase(),
            entry_price: parseFloat(entry),
            protective_stop: parseFloat(sl),
            target: parseFloat(tp),
            quote_amount: parseFloat(risk),
            notes: 'Mở vị thế thủ công từ bảng điều khiển'
        };

        const url = `${BASE_URL}/api/v1/positions`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        return { success: true, data: data.data || data };
    } catch (err) {
        console.warn('[API] createPositionApi error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function closePositionApi(positionId, exitPrice, exitReason = 'MANUAL_CLOSE') {
    try {
        const url = `${BASE_URL}/api/v1/positions/${positionId}/close`;
        const payload = {
            exit_price: parseFloat(exitPrice),
            exit_reason: exitReason,
            notes: 'Chốt lệnh từ giao diện'
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        return { success: true, data: data.data || data };
    } catch (err) {
        console.warn('[API] closePositionApi error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function fetchAccountSummaryApi() {
    try {
        const url = `${BASE_URL}/api/v1/account/summary`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { success: true, data: json.data || json };
    } catch (err) {
        console.warn('[API] fetchAccountSummaryApi error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function fetchCapitalTransactionsApi(limit = 100) {
    try {
        const url = `${BASE_URL}/api/v1/account/transactions?limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { success: true, data: json.data || json || [] };
    } catch (err) {
        console.warn('[API] fetchCapitalTransactionsApi error:', err.message);
        return { success: false, data: [], error: err.message };
    }
}

export async function createCapitalTransactionApi(type, amount, note = '') {
    try {
        const payload = {
            transaction_type: type.toUpperCase(),
            amount: parseFloat(amount),
            note: note || (type === 'DEPOSIT' ? 'Nạp vốn' : 'Rút vốn')
        };

        const url = `${BASE_URL}/api/v1/account/transactions`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        return { success: true, data: data.data || data };
    } catch (err) {
        console.warn('[API] createCapitalTransactionApi error:', err.message);
        return { success: false, error: err.message };
    }
}

// -------------------------------------------------------------
// 4. Formatting & Helpers
// -------------------------------------------------------------

export function cleanSymbol(symbol) {
    if (!symbol) return '';
    return symbol.replace('USDT', '').replace('BUSD', '').replace('USDC', '');
}

export function formatPrice(val) {
    if (val === null || val === undefined || isNaN(val)) return '0.00';
    const num = parseFloat(val);
    if (num === 0) return '0.00';
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
// 5. Human-Friendly Pure Vietnamese Translators (Zero English Jargon)
// -------------------------------------------------------------

export function translateTrend(trend) {
    if (!trend || trend === 'UNAVAILABLE') return 'Chưa xác định';
    switch (trend.toUpperCase()) {
        case 'BULLISH': return 'Tăng mạnh';
        case 'BEARISH': return 'Giảm mạnh';
        case 'MIXED': return 'Đi ngang';
        case 'MIXED_BULLISH': return 'Nghiêng Tăng';
        case 'MIXED_BEARISH': return 'Nghiêng Giảm';
        case 'CONFLICTING': return 'Giằng co';
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
        case 'AT_SUPPORT': return 'Sát Hỗ Trợ Đáy';
        case 'AT_RESISTANCE': return 'Sát Kháng Cự Đỉnh';
        case 'BETWEEN_SUPPORT_AND_RESISTANCE': return 'Lưng Chừng Giữa 2 Cản';
        case 'ABOVE_RESISTANCE': return 'Vượt Trên Kháng Cự';
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
        case 'UNRESOLVED': return 'Chưa Rõ Pha';
        default: return phase;
    }
}

export function translateCycleStage(stage) {
    if (!stage) return '';
    const norm = stage.toUpperCase().trim();
    switch (norm) {
        case 'PHASE_A': return 'Pha A: Chặn Đà Giảm';
        case 'PHASE_B': return 'Pha B: Tích Lũy Xây Nền';
        case 'PHASE_C': return 'Pha C: Rũ Bỏ & Kiểm Định';
        case 'PHASE_D': return 'Pha D: Bứt Phá Trong Biên Độ';
        case 'PHASE_E': return 'Pha E: Bứt Phá Thoát Biên';
        case 'EARLY': return 'Giai Đoạn Đầu';
        case 'MIDDLE':
        case 'MID': return 'Giai Đoạn Giữa';
        case 'LATE': return 'Giai Đoạn Cuối';
        case 'MATURE': return 'Chín Muồi';
        case 'STRUCTURAL_MATURITY': return 'Cấu Trúc Hoàn Thiện';
        case 'STAGE_ADVANCED':
        case 'STAGE_ADVANCE': return 'Chuyển Giai Đoạn';
        case 'TRANSITION': return 'Chuyển Pha';
        default: {
            if (norm.includes('PHASE_A')) return 'Pha A: Chặn Đà Giảm';
            if (norm.includes('PHASE_B')) return 'Pha B: Tích Lũy Xây Nền';
            if (norm.includes('PHASE_C')) return 'Pha C: Rũ Bỏ & Kiểm Định';
            if (norm.includes('PHASE_D')) return 'Pha D: Bứt Phá Trong Biên Độ';
            if (norm.includes('PHASE_E')) return 'Pha E: Bứt Phá Thoát Biên';
            return norm.replace(/_/g, ' ');
        }
    }
}

export function translateStrength(strength) {
    if (!strength) return 'Chờ Xác Nhận';
    switch (strength.toUpperCase().trim()) {
        case 'CONFIRMED': return 'Đã Xác Nhận';
        case 'ESTABLISHED': return 'Đã Thiết Lập';
        case 'PROVISIONAL': return 'Chờ Xác Nhận';
        case 'BOOTSTRAP_PROVISIONAL': return 'Đang Khởi Tạo';
        default:
            return 'Chờ Xác Nhận';
    }
}

export function translateCycleReason(reason) {
    if (!reason) return '';
    const norm = reason.toUpperCase().trim();

    // 1. Khớp chính xác các sự kiện Wyckoff thuần tiếng Việt
    switch (norm) {
        case 'ACCUMULATION_SUSTAINED_DOWN_INVALIDATION': return 'Thủng hỗ trợ, gãy cấu trúc Tích Lũy';
        case 'MARKUP_SUSTAINED_DOWN_INVALIDATION': return 'Gãy sóng tăng, đảo chiều sang Giảm Giá';
        case 'DISTRIBUTION_SUSTAINED_UP_INVALIDATION': return 'Vượt kháng cự, gãy cấu trúc Phân Phối';
        case 'MARKDOWN_SUSTAINED_UP_INVALIDATION': return 'Bứt phá cản, đảo chiều sang Tăng Giá';
        case 'SUSTAINED_DOWN_INVALIDATION': return 'Thủng đáy, gãy hỗ trợ xác nhận';
        case 'SUSTAINED_UP_INVALIDATION': return 'Bứt đỉnh, vượt kháng cự xác nhận';
        case 'THESIS_INVALIDATION': return 'Kịch bản xu hướng bị phủ nhận';
        case 'SUSTAINED_INVALIDATION': return 'Cấu trúc trước đó bị phá vỡ hoàn toàn';

        case 'STRUCTURAL_MATURITY': return 'Cấu trúc nén đạt độ chín muồi';
        case 'STARTED_BALANCE':
        case 'BALANCE_START': return 'Bắt đầu tích tụ cân bằng cung cầu';
        case 'COMPLETED_PATH': return 'Hoàn tất lộ trình chu kỳ';
        case 'SOS_BREAKOUT':
        case 'SIGN_OF_STRENGTH': return 'Bứt phá xác nhận lực cầu mạnh';
        case 'SOW_BREAKDOWN':
        case 'SIGN_OF_WEAKNESS': return 'Thủng đáy xác nhận áp lực bán';
        case 'SPRING_RECLAIM':
        case 'SPRING_RECLAIM_CONFIRMED': return 'Rũ bỏ đáy và lấy lại hỗ trợ';
        case 'UTAD_REJECTION':
        case 'UPTHRUST_REJECTION_CONFIRMED': return 'Bẫy tăng giá vùng đỉnh bị từ chối';
        case 'TYPED_UTAD_ATTEMPT': return 'Xuất hiện bẫy tăng giá vùng đỉnh';
        case 'UTAD_ATTEMPT_SUPERSEDED': return 'Bẫy tăng giá vùng đỉnh bị triệt tiêu';
        case 'STAGE_ADVANCE':
        case 'STAGE_ADVANCED': return 'Chuyển sang giai đoạn tiếp theo';
        case 'CYCLE_DISLOCATION':
        case 'DISLOCATION': return 'Giá biến động lệch ngoài biên độ';
        case 'SUSTAINED_DISLOCATION': return 'Giá lệch ngoài biên độ kéo dài';
        case 'CONFLICT_RESOLUTION': return 'Đã xác nhận hướng đi đa khung';
        case 'OPTIONAL_FACTS_DEGRADED': return 'Độ tin cậy của tín hiệu suy giảm';

        case 'ACCUMULATION_RESOLVED_INTO_MARKUP': return 'Tích lũy hoàn tất ➔ Vào pha Đẩy giá';
        case 'DISTRIBUTION_RESOLVED_INTO_MARKDOWN': return 'Phân phối hoàn tất ➔ Vào pha Giảm giá';
        case 'TRANSITION_CONFIRMED': return 'Chuyển pha bứt phá xác nhận';
        case 'MARKDOWN_CONTINUATION': return 'Tiếp diễn xu hướng Giảm giá';
        case 'MARKUP_CONTINUATION': return 'Tiếp diễn xu hướng Đẩy giá';
        case 'CLIMAX_STOPPING_CONFIRMED':
        case 'SELLING_CLIMAX': return 'Xuất hiện nến cao trào bán hãm đà';
        case 'BUYING_CLIMAX': return 'Xuất hiện nến cao trào mua vùng đỉnh';
        case 'STRUCTURE_AND_SEQUENCE_ALIGNED': return 'Cấu trúc nến và khối lượng đồng thuận';
        case 'SEQUENCE_CHANGE_OF_CHARACTER': return 'Đổi tính chất xu hướng sóng';
        case 'DIRECTIONAL_SEQUENCE_WITHOUT_STRUCTURE': return 'Dòng tiền tạo đà chưa bứt cản';
        case 'BALANCE_AFTER_PRIOR_MARKDOWN': return 'Hấp thụ cân bằng sau đà giảm';
        case 'BALANCE_AFTER_PRIOR_MARKUP': return 'Tích tụ cân bằng sau đà tăng';
        case 'DETERMINISTIC_BALANCE_FALLBACK': return 'Giằng co cân bằng trong biên độ';
        case 'COMPLETE_ACCUMULATION_SEQUENCE': return 'Hoàn tất chuỗi Tích Lũy';
        case 'COMPLETE_DISTRIBUTION_SEQUENCE': return 'Hoàn tất chuỗi Phân Phối';
        case 'BREAKOUT_CONFIRMED': return 'Bứt phá kháng cự xác nhận';
        case 'BREAKDOWN_CONFIRMED': return 'Gãy thủng hỗ trợ xác nhận';
        case 'CONFLICTING_TRANSITION_EVIDENCE': return 'Tín hiệu chuyển pha chưa đồng thuận';
        case 'DISLOCATED_PRICE_ACTION': return 'Biến động lệch ngoài biên độ';
        case 'BOOTSTRAP_RECONCILED':
        case 'BOOTSTRAP_RECONCILIATION': return 'Khởi đầu chu kỳ mới';
        case 'CYCLE_REANCHORED': return 'Tái lập mốc biên độ';
        case 'BOOTSTRAP_SELECTION': return 'Đang chọn lọc cấu trúc chu kỳ';
        case 'BOOTSTRAP_AUTHORITY': return 'Xác thực cấu trúc chu kỳ';
        case 'BOOTSTRAP_PROVISIONAL': return 'Cấu trúc đang phát triển';
        case 'BOOTSTRAP_V1_HINT':
        case 'V1_HINT':
        case 'BOOTSTRAP_HINT': return 'Mới chớm hình thành pha';
        case 'BOOTSTRAP_CREATED': return 'Bắt đầu chu kỳ mới';
        case 'CONTINUATION': return 'Tiếp diễn đà giá';
        case 'MARKUP': return 'Tiếp diễn xu hướng Đẩy giá';
        case 'MARKDOWN': return 'Tiếp diễn xu hướng Giảm giá';
        case 'ACCUMULATION': return 'Tích lũy gom hàng';
        case 'DISTRIBUTION': return 'Phân phối xả hàng';
        case 'REACCUMULATION':
        case 'RE_ACCUMULATION': return 'Tái tích lũy gom hàng';
        case 'REDISTRIBUTION':
        case 'RE_DISTRIBUTION': return 'Tái phân phối xả hàng';
        case 'NO_TRANSITION': return 'Duy trì trạng thái hiện tại';
    }

    // 2. Bộ lọc thông minh phòng ngừa chuỗi động từ Backend
    if (norm.includes('INVALIDATION')) {
        if (norm.includes('ACCUMULATION') && norm.includes('DOWN')) return 'Thủng hỗ trợ, gãy cấu trúc Tích Lũy';
        if (norm.includes('MARKUP') && norm.includes('DOWN')) return 'Gãy sóng tăng, đảo chiều sang Giảm';
        if (norm.includes('DISTRIBUTION') && norm.includes('UP')) return 'Vượt kháng cự, gãy cấu trúc Phân Phối';
        if (norm.includes('MARKDOWN') && norm.includes('UP')) return 'Bứt phá cản, đảo chiều sang Tăng';
        if (norm.includes('DOWN')) return 'Thủng đáy, gãy hỗ trợ xác nhận';
        if (norm.includes('UP')) return 'Vượt đỉnh, gãy cấu trúc cản';
        return 'Gãy cấu trúc chu kỳ';
    }

    if (norm.includes('DISLOCATION')) {
        if (norm.includes('DOWN')) return 'Biến động thủng biên dưới';
        if (norm.includes('UP')) return 'Biến động vượt biên trên';
        return 'Giá biến động lệch ngoài biên độ';
    }

    if (norm.includes('SPRING')) return 'Rũ bỏ đáy gom hàng';
    if (norm.includes('UTAD') || norm.includes('UPTHRUST')) return 'Bẫy tăng giá vùng đỉnh';
    if (norm.includes('CLIMAX')) return 'Nến cao trào hãm đà';
    if (norm.includes('BALANCE')) return 'Tích tụ cân bằng trong biên độ';
    if (norm.includes('BREAKOUT') || norm.includes('BREAK_UP')) return 'Bứt phá kháng cự xác nhận';
    if (norm.includes('BREAKDOWN') || norm.includes('BREAK_DOWN')) return 'Thủng hỗ trợ xác nhận';
    if (norm.includes('REACCUMULATION')) return 'Tái tích lũy gom hàng';
    if (norm.includes('REDISTRIBUTION')) return 'Tái phân phối xả hàng';
    if (norm.includes('ACCUMULATION')) return 'Tích lũy gom hàng';
    if (norm.includes('DISTRIBUTION')) return 'Phân phối xả hàng';
    if (norm.includes('MARKUP')) return 'Đẩy giá tăng trưởng';
    if (norm.includes('MARKDOWN')) return 'Giảm giá xả hàng';

    // 3. Fallback sạch sẽ
    return norm.replace(/_/g, ' ');
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
        case 'RANGE_BOUND': return 'Dao Động Trong Biên Độ';
        default: return pattern;
    }
}

export function translateCycleValidity(validity) {
    if (!validity) return '';
    switch (validity.toUpperCase().trim()) {
        case 'CURRENT': return 'Hợp Lệ';
        case 'LAGGING': return 'Trễ Nhịp';
        case 'DISLOCATED': return 'Lệch Cấu Trúc';
        case 'CONFLICTING': return 'Xung Đột Đa Khung';
        case 'DEGRADED': return 'Chất Lượng Thấp';
        default: return validity;
    }
}

export function translateLegOrdinal(leg) {
    if (leg === null || leg === undefined || isNaN(leg)) return '';
    return `Nhịp ${Number(leg) + 1}`;
}

export function translateCycleProgress(progress) {
    if (!progress) return '';
    switch (progress.toUpperCase().trim()) {
        case 'STABLE': return 'Ổn Định';
        case 'ACTIVE': return 'Đang Hoạt Động';
        case 'CANDIDATE': return 'Đang Theo Dõi';
        case 'DEVELOPING':
        case 'PROGRESSING': return 'Đang Tiến Triển';
        case 'ACCELERATING': return 'Tăng Tốc Đà Giá';
        case 'DECELERATING': return 'Giảm Tốc Hãm Đà';
        case 'EXHAUSTING': return 'Cạn Kiệt Đà Giá';
        case 'RESOLVING': return 'Đang Chốt Pha';
        default: return progress;
    }
}

export function translateRejectionReason(reason) {
    if (!reason) return 'Chưa đủ điều kiện vào lệnh.';
    const norm = reason.toUpperCase().trim();
    switch (norm) {
        case 'CONTEXT_UNAVAILABLE': return 'Chưa đủ dữ liệu thị trường để đánh giá';
        case 'UNSUPPORTED_SCOPE': return 'Khung thời gian hiện tại chưa hỗ trợ';
        case 'LOCATION_UNAVAILABLE': return 'Vị trí giá hiện tại chưa tối ưu';
        case 'STALE_EVIDENCE': return 'Tín hiệu thị trường đã quá cũ';
        case 'CONFLICTING_CONFIRMED_EVIDENCE': return 'Tín hiệu đa khung thời gian đang xung đột';
        case 'NO_CONFIRMED_MICRO_TRIGGER': return 'Chưa có nến xác nhận đạt chuẩn để vào lệnh';
        case 'NO_CONFIRMED_POST_BREAK_RETEST': return 'Chưa có nhịp kiểm định lại sau khi phá vỡ cản';
        case 'NO_CONFIRMED_RANGE_BREAK_CONTINUATION': return 'Chưa xác nhận sóng tiếp diễn sau khi phá biên độ';
        case 'NO_CONFIRMED_SC_SPRING_RECOVERY': return 'Chưa xác nhận nhịp phục hồi sau cú rũ bỏ đáy';
        case 'NO_CONFIRMED_SC_MARKUP_RECOVERY': return 'Chưa xác nhận nhịp phục hồi tiếp diễn đà tăng';
        case 'SC_MARKUP_RECOVERY_INVALIDATED': return 'Kịch bản phục hồi đà tăng đã bị gãy';
        case 'SC_MARKUP_ROLE_FLIP_UNAVAILABLE': return 'Kháng cự cũ chưa xác nhận đảo vai thành hỗ trợ';
        case 'NO_CONFIRMED_SHORT_MARKDOWN_RECOVERY': return 'Chưa có nhịp kiểm định cản để vào lệnh Bán';
        case 'NO_CONFIRMED_SHORT_BREAK_CONTINUATION': return 'Chưa xác nhận tiếp diễn phá vỡ đáy';
        case 'NO_CONFIRMED_RANGE_BREAK_IMPULSE': return 'Chưa có xung lực bứt phá khỏi vùng tích lũy';
        case 'SC_MARKDOWN_RECOVERY_INVALIDATED': return 'Kịch bản giảm giá hồi phục đã bị phủ nhận';
        case 'SHORT_EPOCH_SUPERSEDED': return 'Chu kỳ giảm cũ đã kết thúc và chuyển pha mới';
        case 'NO_POLICY_PROPOSAL': return 'Chưa có mô hình nến đạt chuẩn để vào lệnh';
        case 'INSUFFICIENT_BREAKOUT_EFFORT': return 'Khối lượng bứt phá chưa đủ lớn để xác nhận';
        case 'RBI_PROMPT_VALUE_LOCATION_UNAVAILABLE': return 'Vị trí giá chưa an toàn để kích hoạt lệnh bứt phá';
        case 'CYCLE_PHASE_BOOTSTRAP': return 'Chu kỳ thị trường đang trong giai đoạn khởi tạo';
        case 'CYCLE_PHASE_CONFLICT': return 'Chu kỳ đang có xung đột cấu trúc cung cầu';
        case 'CYCLE_PHASE_DISLOCATED': return 'Giá đang biến động lệch ngoài biên độ tích lũy';
        case 'CYCLE_TIMELINE_LAG': return 'Tín hiệu chu kỳ đang bị trễ nhịp thời gian';
        case 'CYCLE_PHASE_NOT_DIRECTIONALLY_CONFIRMED': return 'Hướng chu kỳ chưa đồng thuận với hướng vào lệnh';
        default: return translateCycleReason(reason) || reason;
    }
}

export function translateEffort(type) {
    if (!type) return 'Bình thường';
    switch (type.toUpperCase()) {
        case 'HIGH_EFFORT_LOW_RESULT':
            return 'Cá mập hấp thụ nguồn cung';
        case 'HIGH_EFFORT_HIGH_RESULT':
            return 'Dòng tiền bùng nổ mạnh mẽ';
        case 'LOW_EFFORT_HIGH_RESULT':
            return 'Cạn kiệt lực cản đối ứng';
        case 'LOW_EFFORT_LOW_RESULT':
            return 'Thị trường cạn kiệt nguồn cung';
        default:
            return type;
    }
}

export function getFriendlyVPAStatus(effortResult) {
    if (!effortResult) {
        return {
            headline: 'Thanh khoản bình thường',
            detail: 'Khối lượng ổn định quanh mức trung bình',
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
                detail: `Khối lượng ${vol.toFixed(1)}x · Biên độ ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-emerald'
            };
        case 'HIGH_EFFORT_LOW_RESULT':
            return {
                headline: 'Hấp thụ cạn cung',
                detail: `Khối lượng ${vol.toFixed(1)}x · Nến nén ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-amber'
            };
        case 'LOW_EFFORT_HIGH_RESULT':
            return {
                headline: 'Giá bay cạn cản',
                detail: `Khối lượng ${vol.toFixed(1)}x · Biên độ ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-emerald'
            };
        case 'LOW_EFFORT_LOW_RESULT':
            return {
                headline: 'Thị trường cạn cung',
                detail: `Khối lượng ${vol.toFixed(1)}x · Nến nén ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-secondary'
            };
        default:
            return {
                headline: `Khối lượng ${vol.toFixed(1)}x trung bình`,
                detail: `Biên độ ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-secondary'
            };
    }
}

export function translateDecisionStatus(status) {
    if (!status) return 'Chưa rõ';
    switch (status.toUpperCase()) {
        case 'PROPOSED': return 'Có Điểm Vào Lệnh';
        case 'WAITING_CONFIRMATION': return 'Chờ Xác Nhận';
        case 'REJECTED': return 'Chưa Đủ Điều Kiện';
        default: return status;
    }
}

export function formatDecisionExplanation(data) {
    if (!data) return 'Đang quan sát thị trường.';

    // 1. If actionable trade plan is available
    if (data.plan) {
        const dir = data.plan.direction === 'SHORT' ? 'Bán' : 'Mua';
        const setup = getFriendlyWyckoffTitle(data.plan.policy_id, data.plan.direction);
        const rr = data.plan.reward_risk ? data.plan.reward_risk.toFixed(2) : '2.0';
        return `Kích hoạt kế hoạch ${dir} với tỷ lệ R:R = ${rr} R. Đã xác nhận mô hình: ${setup}.`;
    }

    // 2. If holding an open position
    if (data.position && data.position.status === 'OPEN') {
        const dir = data.position.direction === 'SHORT' ? 'Bán' : 'Mua';
        return `Đang nắm giữ vị thế ${dir}. Hệ thống theo dõi tín hiệu bảo vệ vốn và đảo chiều để tối ưu hóa lợi nhuận.`;
    }

    // 3. Priority: Render the smart decision.waiting_for directly from backend API
    if (data.decision?.waiting_for) {
        return data.decision.waiting_for;
    }

    // 4. Fallback if in Waiting / No-Trade state
    const sup = data.key_levels?.support;
    const res = data.key_levels?.resistance;
    const isSupAvail = sup && sup.status === 'AVAILABLE';
    const isResAvail = res && res.status === 'AVAILABLE';

    // Case 4a: Price discovery above resistance
    if (!isResAvail && isSupAvail) {
        return 'Giá vừa bứt phá vượt vùng đỉnh. Chờ nhịp kiểm định lại hoặc tích lũy cạn cung để thiết lập điểm vào lệnh an toàn.';
    }

    // Case 4b: Price discovery below support
    if (!isSupAvail && isResAvail) {
        return 'Giá đang trong vùng dò đáy mới. Chờ xuất hiện nến cao trào hãm đà và cấu trúc tái tích lũy trước khi mở vị thế.';
    }

    // Case 4c: Close to Support (distance <= 2.5%)
    if (isSupAvail && sup.distance_percent != null && sup.distance_percent <= 2.5) {
        return `Giá đang phản ứng gần vùng Hỗ Trợ ($${formatPrice(sup.lower)} – $${formatPrice(sup.upper)}). Chờ nến 4H đóng xác nhận tín hiệu cạn cung để kích hoạt lệnh Mua.`;
    }

    // Case 4d: Close to Resistance (distance <= 2.5%)
    if (isResAvail && res.distance_percent != null && res.distance_percent <= 2.5) {
        return `Giá đang tiếp cận vùng Kháng Cự ($${formatPrice(res.lower)} – $${formatPrice(res.upper)}). Chờ nến 4H đóng xác nhận tín hiệu từ chối giá để kích hoạt lệnh Bán.`;
    }

    // Case 4e: Between Support and Resistance
    if (isSupAvail && isResAvail) {
        return `Giá đang dao động lưng chừng giữa 2 cản ($${formatPrice(sup.upper)} – $${formatPrice(res.lower)}). Kiên nhẫn quan sát, không mở vị thế ở vùng giá bất lợi.`;
    }

    const rawReason = data.decision?.reason || data.reason;
    if (rawReason) {
        return translateRejectionReason(rawReason);
    }
    return 'Chưa đủ điều kiện vào lệnh. Chờ nến 4H tiếp theo để xác nhận.';
}

export function translateAction(action) {
    if (!action) return { text: 'Quan sát', class: 'badge-neutral' };
    switch (action.toUpperCase()) {
        case 'BUY_READY':
            return { text: 'Sẵn Sàng Mua', class: 'badge-emerald' };
        case 'SHORT_READY':
            return { text: 'Sẵn Sàng Bán', class: 'badge-rose' };
        case 'NO_TRADE':
        default:
            return { text: 'Quan sát', class: 'badge-neutral' };
    }
}

export function getFriendlyWyckoffTitle(policyId, direction = 'LONG') {
    if (!policyId) return direction === 'LONG' ? 'Mô hình Gom Hàng Tích Lũy' : 'Mô hình Phân Phối Xả Hàng';
    
    switch (policyId.toUpperCase()) {
        case 'WYCKOFF_CLIMAX_BASE_ACCUMULATION_V1':
            return 'Gom Hàng Đáy Cạn Cung';
        case 'SC_SPRING_RECOVERY_V1':
        case 'SC_MARGINAL_SPRING_RECOVERY_V1':
            return 'Bẫy Rũ Bỏ Đáy & Gom Hàng';
        case 'SC_SECONDARY_TEST_ABSORPTION_V1':
            return 'Kiểm Định Đáy & Hấp Thụ Cung';
        case 'SC_TERMINAL_ABSORPTION_REVERSAL_V1':
            return 'Đảo Chiều Hấp Thụ Cực Đại';
        case 'SC_MARKUP_RECOVERY_V2':
            return 'Đổi Vai Kháng Cự Thành Hỗ Trợ';
        case 'SC_MARKDOWN_RECOVERY_V1':
            return 'Kiểm Định Lại Nhịp Rũ Hàng';
        case 'SHORT_BREAK_CONTINUATION_V1':
            return 'Phá Vỡ Hỗ Trợ Tiếp Diễn Đà Giảm';
        case 'POST_BREAK_RETEST_V2':
            return 'Kiểm Định Lại Vùng Vừa Phá Vỡ';
        case 'POST_BREAK_LOW_SUPPLY_ACCEPTANCE_V1':
            return 'Cạn Cung Sau Phá Vỡ Cản';
        case 'RANGE_BREAK_IMPULSE_V1':
            return 'Bứt Phá Biên Độ Tích Lũy';
        case 'RANGE_BREAK_CONTINUATION_V1':
            return 'Mở Rộng Biên Độ Sóng Tăng';
        case 'DIRECTIONAL_OPEN_SURFACE_V1':
        case 'DIRECTIONAL_OPEN_SURFACE_ACCEPTANCE_V1':
            return 'Bứt Phá Khám Phá Vùng Giá Mới';
        case 'MICRO_SPRING_UPTHRUST_V1':
            return 'Bẫy Thanh Khoản Đảo Chiều';
        default:
            return direction === 'LONG' ? 'Mô hình Mua Tích Lũy' : 'Mô hình Bán Phân Phối';
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
        return `"Khối lượng giao dịch tăng cao gấp ${vol.toFixed(2)}x mức trung bình nhưng nến bị nén chặt. Lực bán bị dòng tiền lớn hấp thụ hoàn toàn, sẵn sàng cho nhịp đảo chiều tăng."`;
    }
    if (effort === 'HIGH_EFFORT_HIGH_RESULT') {
        return `"Khối lượng bùng nổ gấp ${vol.toFixed(2)}x mức trung bình đồng pha với thân nến mở rộng quyết liệt. Dòng tiền lớn tham gia xác nhận xu hướng bứt phá."`;
    }
    if (effort === 'LOW_EFFORT_HIGH_RESULT') {
        return `"Nguồn cung cạn kiệt hoàn toàn, giá di chuyển thanh thoát nhẹ nhàng mà không gặp lực cản đối ứng."`;
    }
    return `"Cấu trúc nén chặt tại vùng cản trọng yếu ($${support ? formatPrice(support) : 'Hỗ trợ'} – $${resistance ? formatPrice(resistance) : 'Kháng cự'}), khối lượng kiểm định đạt chuẩn, mở ra cơ hội vào lệnh an toàn."`;
}
