import React, { useMemo } from 'react';
import { Card } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import {
  TREND_CHART_HEIGHT,
  CHART_OPTION,
} from '../../constants/monitor.constants';

initVChartSemiTheme();

const makeAreaSpec = (data, title, color) => ({
  type: 'area',
  data: [{ values: data || [] }],
  xField: 'date',
  yField: 'value',
  area: { style: { fill: { gradient: 'linear', x0: 0, y0: 0, x1: 0, y1: 1, stops: [{ offset: 0, color: color + '40' }, { offset: 1, color: color + '05' }] } } },
  line: { style: { stroke: color, lineWidth: 2 } },
  point: { visible: false },
  axes: [
    { orient: 'bottom', label: { style: { fontSize: 10 } }, tick: { visible: false } },
    { orient: 'left', label: { style: { fontSize: 10 } }, grid: { style: { lineDash: [4, 4] } } },
  ],
  tooltip: { mark: { title: { visible: false } } },
  title: { visible: true, text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
  padding: { top: 5, bottom: 20, left: 10, right: 10 },
});

const makeBarSpec = (data, title, color) => ({
  type: 'bar',
  data: [{ values: data || [] }],
  xField: 'date',
  yField: 'value',
  bar: { style: { fill: color, cornerRadius: [4, 4, 0, 0] } },
  axes: [
    { orient: 'bottom', label: { style: { fontSize: 10 } }, tick: { visible: false } },
    { orient: 'left', label: { style: { fontSize: 10 } }, grid: { style: { lineDash: [4, 4] } } },
  ],
  tooltip: { mark: { title: { visible: false } } },
  title: { visible: true, text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
  padding: { top: 5, bottom: 20, left: 10, right: 10 },
});

const CHARTS_ADMIN = [
  { key: 'consume', field: 'consume_trend', titleKey: '消耗趋势', type: 'area', color: '#6366f1' },
  { key: 'request', field: 'request_trend', titleKey: '请求量', type: 'bar', color: '#f97316' },
  { key: 'token', field: 'token_trend', titleKey: 'Token消耗', type: 'area', color: '#10b981' },
  { key: 'topup', field: 'topup_trend', titleKey: '充值趋势', type: 'bar', color: '#3b82f6' },
];

const formatDateShort = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
};

const TrendChartPanels = ({ data, loading, isAdmin, timeRange, t }) => {
  const charts = isAdmin
    ? CHARTS_ADMIN
    : CHARTS_ADMIN.filter((c) => c.key !== 'topup');

  const gridCols = isAdmin
    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-3';

  const hasCustomRange = timeRange?.start && timeRange?.end;

  const specs = useMemo(() => {
    return charts.map((chart) => {
      const chartData = data?.[chart.field] || [];
      // Format date labels to show only MM-DD
      const formatted = chartData.map((p) => ({
        ...p,
        date: p.date ? p.date.slice(5) : p.date,
      }));
      const suffix = hasCustomRange
        ? `（${formatDateShort(timeRange.start)} ~ ${formatDateShort(timeRange.end)}）`
        : '（14' + t('天') + '）';
      const title = t(chart.titleKey) + suffix;
      return chart.type === 'area'
        ? makeAreaSpec(formatted, title, chart.color)
        : makeBarSpec(formatted, title, chart.color);
    });
  }, [data, charts, t, hasCustomRange, timeRange]);

  return (
    <div className={`grid ${gridCols} gap-3 mb-4`}>
      {charts.map((chart, idx) => (
        <Card
          key={chart.key}
          bodyStyle={{ padding: 12 }}
          className='!rounded-2xl border-0 shadow-sm'
        >
          <div style={{ height: TREND_CHART_HEIGHT }}>
            {!loading && specs[idx] && (
              <VChart
                spec={specs[idx]}
                option={CHART_OPTION}
                style={{ height: '100%', width: '100%' }}
              />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default TrendChartPanels;
