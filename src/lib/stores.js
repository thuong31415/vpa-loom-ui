import { writable, derived } from 'svelte/store';
import { fetchOpenPositionsApi } from './api.js';

/**
 * Store lưu trữ danh sách các vị thế đang mở (OPEN)
 */
export const openPositions = writable([]);

/**
 * Derived store lưu tập hợp Set các symbol đang có vị thế mở (ví dụ: Set(['ZKUSDT', 'BTCUSDT']))
 */
export const openSymbols = derived(openPositions, ($pos) => {
    return new Set(($pos || []).map(p => p.symbol));
});

/**
 * Hàm nạp vị thế mở từ Backend và cập nhật vào store
 */
export async function refreshOpenPositions() {
    try {
        const res = await fetchOpenPositionsApi();
        if (res && res.success && Array.isArray(res.data)) {
            openPositions.set(res.data);
            return res.data;
        }
    } catch (err) {
        console.warn('[stores] refreshOpenPositions error:', err);
    }
    return [];
}
