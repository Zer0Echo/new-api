import React, { useMemo } from 'react';
import { Card } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import {
  DIST_CHART_HEIGHT,
  CHART_OPTION,
} from '../../constants/monitor.constants';

const makePieSpec = (data, title) => ({
  type: 'pie',
  data: [{ values: data || [] }],
  valueField: 'value',
  categoryField: 'name',
  outerRadius: 0.85,
  innerRadius: 0.55,
  pie: { style: { cornerRadius: 4 } },
  label: {
    visible: true,
    position: 'outside',
    style: { fontSize: 10 },
    line: { smooth: true },
  },
  tooltip: { mark: { content: [{ key: (d) => d.name, value: (d) => d.value?.toLocaleString() }] } },
  title: { visible: true, text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
  legends: { visible: true, orient: 'bottom', item: { shape: { style: { size: 8 } } } },
  padding: { top: 5, bottom: 10, left: 10, right: 10 },
});

const makeHBarSpec = (data, title, color) => ({
  type: 'bar',
  data: [{ values: (data || []).slice().reverse() }],
  xField: 'value',
  yField: 'name',
  direction: 'horizontal',
  bar: { style: { fill: color, cornerRadius: [0, 4, 4, 0] } },
  axes: [
    { orient: 'left', label: { style: { fontSize: 10 } }, tick: { visible: false } },
    { orient: 'bottom', label: { style: { fontSize: 10 } }, grid: { style: { lineDash: [4, 4] } } },
  ],
  tooltip: { mark: { title: { visible: false } } },
  title: { visible: true, text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
  padding: { top: 5, bottom: 20, left: 10, right: 10 },
});

const PANELS_ADMIN = [
  { key: 'model_dist', field: 'model_request_dist', titleKey: '模型请求分布', type: 'pie' },
  { key: 'user_dist', field: 'user_request_dist', titleKey: '用户请求分布', type: 'pie', adminOnly: true },
  { key: 'top_models', field: 'top_models', titleKey: '热门模型Top6', type: 'hbar', color: '#6366f1' },
  { key: 'top_users', field: 'top_users', titleKey: '活跃用户Top6', type: 'hbar', color: '#f97316', adminOnly: true },
];

const formatDateShort = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
};

const DistributionPanels = ({ data, loading, isAdmin, timeRange, t }) => {
  const panels = isAdmin
    ? PANELS_ADMIN
    : PANELS_ADMIN.filter((p) => !p.adminOnly);

  const gridCols = isAdmin
    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-2';

  const hasCustomRange = timeRange?.start && timeRange?.end;

  const specs = useMemo(() => {
    return panels.map((panel) => {
      const chartData = data?.[panel.field] || [];
      const suffix = hasCustomRange
        ? `（${formatDateShort(timeRange.start)} ~ ${formatDateShort(timeRange.end)}）`
        : '';
      const title = t(panel.titleKey) + suffix;
      if (panel.type === 'pie') return makePieSpec(chartData, title);
      return makeHBarSpec(chartData, title, panel.color);
    });
  }, [data, panels, t, hasCustomRange, timeRange]);

  return (
    <div className={`grid ${gridCols} gap-3 mb-4`}>
      {panels.map((panel, idx) => (
        <Card
          key={panel.key}
          bodyStyle={{ padding: 12 }}
          className='!rounded-2xl border-0 shadow-sm'
        >
          <div style={{ height: DIST_CHART_HEIGHT }}>
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

export default DistributionPanels;
