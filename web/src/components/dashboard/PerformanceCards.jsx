import React from 'react';
import { Card, Skeleton } from '@douyinfe/semi-ui';
import {
  Database,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { formatNumber } from '../../constants/monitor.constants';

const PERF_CARDS = [
  {
    key: 'tokens',
    labelKey: '总Tokens',
    icon: Database,
    color: '#6366f1',
    bg: '#eef2ff',
    format: (d) => formatNumber(d?.total_tokens),
  },
  {
    key: 'requests',
    labelKey: '总请求',
    icon: Zap,
    color: '#f97316',
    bg: '#fff7ed',
    format: (d) => formatNumber(d?.total_requests),
  },
  {
    key: 'latency',
    labelKey: '平均延迟',
    icon: Clock,
    color: '#3b82f6',
    bg: '#eff6ff',
    format: (d) => `${d?.avg_latency || 0}ms`,
  },
  {
    key: 'success',
    labelKey: '成功率',
    icon: CheckCircle,
    color: '#10b981',
    bg: '#ecfdf5',
    format: (d) => `${(d?.success_rate || 0).toFixed(1)}%`,
  },
  {
    key: 'errors',
    labelKey: '今日错误',
    icon: AlertTriangle,
    color: '#ef4444',
    bg: '#fef2f2',
    format: (d) => formatNumber(d?.today_errors),
  },
  {
    key: 'ttft',
    labelKey: '首字延迟',
    icon: Timer,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    format: (d) => `${d?.avg_ttft || 0}ms`,
  },
];

const PerformanceCards = ({ data, loading, t }) => {
  return (
    <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4'>
      {PERF_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.key}
            bodyStyle={{ padding: '14px 16px' }}
            className='!rounded-2xl border-0 shadow-sm'
          >
            <div className='flex items-center gap-3'>
              <div
                className='flex items-center justify-center rounded-xl'
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: card.bg,
                }}
              >
                <Icon size={16} color={card.color} />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='text-xs text-semi-color-text-2 truncate'>
                  {t(card.labelKey)}
                </div>
                <Skeleton
                  loading={loading}
                  active
                  placeholder={
                    <Skeleton.Paragraph
                      rows={1}
                      style={{ width: 50, height: 20, marginTop: 2 }}
                    />
                  }
                >
                  <div className='text-lg font-bold truncate'>
                    {card.format(data)}
                  </div>
                </Skeleton>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default PerformanceCards;
