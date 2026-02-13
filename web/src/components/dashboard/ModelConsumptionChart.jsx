import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import {
  API,
  isAdmin,
  modelColorMap,
  modelToColor,
  renderQuota,
  getQuotaWithUnit,
} from '../../helpers';
import {
  processRawData,
  aggregateDataByTimeAndModel,
  generateChartTimePoints,
  updateMapValue,
  initializeMaps,
} from '../../helpers/dashboard';

initVChartSemiTheme({ isWatchingThemeSwitch: true });

const CHART_CONFIG = { mode: 'desktop-browser' };

const ModelConsumptionChart = ({ t }) => {
  const [loading, setLoading] = useState(true);
  const [spec, setSpec] = useState(null);

  const buildSpec = useCallback(
    (chartData, totalQuota, modelColors) => ({
      type: 'bar',
      data: [{ id: 'barData', values: chartData }],
      xField: 'Time',
      yField: 'Usage',
      seriesField: 'Model',
      stack: true,
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('模型消耗分布'),
        subtext: `${t('总计')}：${renderQuota(totalQuota, 2)}`,
        textStyle: { fontSize: 13, fontWeight: 600 },
      },
      padding: { top: 5, bottom: 10, left: 10, right: 10 },
      bar: {
        state: {
          hover: { stroke: '#000', lineWidth: 1 },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => renderQuota(datum['rawQuota'] || 0, 4),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => datum['rawQuota'] || 0,
            },
          ],
          updateContent: (array) => {
            array.sort((a, b) => b.value - a.value);
            let sum = 0;
            for (let i = 0; i < array.length; i++) {
              if (array[i].key === '其他') continue;
              let value = parseFloat(array[i].value);
              if (isNaN(value)) value = 0;
              if (array[i].datum && array[i].datum.TimeSum) {
                sum = array[i].datum.TimeSum;
              }
              array[i].value = renderQuota(value, 4);
            }
            array.unshift({
              key: t('总计'),
              value: renderQuota(sum, 4),
            });
            return array;
          },
        },
      },
      color: { specified: modelColors },
    }),
    [t],
  );

  const fetchAndProcess = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startTs = Math.floor(todayStart.getTime() / 1000);
      const endTs = Math.floor(now.getTime() / 1000) + 3600;

      const base = isAdmin() ? '/api/data/' : '/api/data/self/';
      const url = `${base}?start_timestamp=${startTs}&end_timestamp=${endTs}&default_time=hour`;
      const res = await API.get(url);
      const { success, data } = res.data;

      if (!success || !data || data.length === 0) {
        setSpec(
          buildSpec(
            [],
            0,
            modelColorMap,
          ),
        );
        return;
      }

      data.sort((a, b) => a.created_at - b.created_at);

      const processed = processRawData(
        data,
        'hour',
        initializeMaps,
        updateMapValue,
      );

      const modelColors = {};
      Array.from(processed.uniqueModels).forEach((name) => {
        modelColors[name] =
          modelColorMap[name] || modelToColor(name);
      });

      const aggregated = aggregateDataByTimeAndModel(data, 'hour');
      const timePoints = generateChartTimePoints(aggregated, data, 'hour');

      let chartData = [];
      timePoints.forEach((time) => {
        let timeData = Array.from(processed.uniqueModels).map((model) => {
          const key = `${time}-${model}`;
          const agg = aggregated.get(key);
          return {
            Time: time,
            Model: model,
            rawQuota: agg?.quota || 0,
            Usage: agg?.quota ? getQuotaWithUnit(agg.quota, 4) : 0,
          };
        });
        const timeSum = timeData.reduce((s, item) => s + item.rawQuota, 0);
        timeData.sort((a, b) => b.rawQuota - a.rawQuota);
        timeData = timeData.map((item) => ({ ...item, TimeSum: timeSum }));
        chartData.push(...timeData);
      });

      chartData.sort((a, b) => a.Time.localeCompare(b.Time));
      setSpec(buildSpec(chartData, processed.totalQuota, modelColors));
    } catch (e) {
      console.error('ModelConsumptionChart fetch error:', e);
      setSpec(buildSpec([], 0, modelColorMap));
    } finally {
      setLoading(false);
    }
  }, [buildSpec]);

  useEffect(() => {
    fetchAndProcess();
  }, [fetchAndProcess]);

  return (
    <Card
      className='!rounded-2xl shadow-sm border-0'
      bodyStyle={{ padding: 12 }}
    >
      <Spin spinning={loading}>
        <div style={{ height: 380 }}>
          {spec && <VChart spec={spec} option={CHART_CONFIG} style={{ height: '100%', width: '100%' }} />}
        </div>
      </Spin>
    </Card>
  );
};

export default ModelConsumptionChart;
