export const PERIOD_CARDS = [
  {
    key: 'today',
    labelKey: '今日',
    gradient: 'linear-gradient(135deg, #e0f2ff 0%, #c7e6ff 100%)',
    textColor: '#1e3a5f',
    accentColor: '#2563eb',
  },
  {
    key: 'week',
    labelKey: '本周',
    gradient: 'linear-gradient(135deg, #e8fce8 0%, #c8f0c8 100%)',
    textColor: '#1a3d1a',
    accentColor: '#16a34a',
  },
  {
    key: 'month',
    labelKey: '本月',
    gradient: 'linear-gradient(135deg, #fff0f0 0%, #ffd6d6 100%)',
    textColor: '#5f1e1e',
    accentColor: '#dc2626',
  },
];

export const TREND_CHART_HEIGHT = 260;
export const DIST_CHART_HEIGHT = 300;
export const CHART_OPTION = { mode: 'desktop-browser' };

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  const n = Number(num);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}
