import React from 'react';
import { Card, Skeleton } from '@douyinfe/semi-ui';
import {
  Users,
  UserPlus,
  Crown,
  Server,
  Wallet,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { renderQuota } from '../../helpers';
import { formatNumber } from '../../constants/monitor.constants';

const ADMIN_CARDS = [
  {
    key: 'total_users',
    labelKey: '总用户',
    icon: Users,
    color: '#6366f1',
    bg: '#eef2ff',
    format: (d) => formatNumber(d?.total_users),
    sub: (d, t) => `${t('活跃')} ${formatNumber(d?.active_users || 0)}`,
  },
  {
    key: 'today_new',
    labelKey: '今日新增',
    icon: UserPlus,
    color: '#f97316',
    bg: '#fff7ed',
    format: (d) => formatNumber(d?.today_new_users),
    sub: (d, t) => `${t('本月')} ${formatNumber(d?.month_new_users)}`,
  },
  {
    key: 'subscription',
    labelKey: '订阅用户',
    icon: Crown,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    format: (d) => formatNumber(d?.subscription_users),
  },
  {
    key: 'channels',
    labelKey: '渠道',
    icon: Server,
    color: '#3b82f6',
    bg: '#eff6ff',
    format: (d) => `${d?.active_channels || 0}/${d?.total_channels || 0}`,
  },
  {
    key: 'balance',
    labelKey: '总余额',
    icon: Wallet,
    color: '#10b981',
    bg: '#ecfdf5',
    format: (d) => renderQuota(d?.total_balance),
  },
  {
    key: 'topup',
    labelKey: '总充值',
    icon: DollarSign,
    color: '#eab308',
    bg: '#fefce8',
    format: (d) => '$' + (d?.total_topup || 0).toFixed(2),
  },
  {
    key: 'consumed',
    labelKey: '总消耗',
    icon: TrendingDown,
    color: '#ef4444',
    bg: '#fef2f2',
    format: (d) => renderQuota(d?.total_consumed),
  },
  {
    key: 'profit',
    labelKey: '预估利润',
    icon: TrendingUp,
    color: '#06b6d4',
    bg: '#ecfeff',
    format: (d) => '$' + (d?.estimated_profit || 0).toFixed(2),
  },
];

const USER_CARDS = (t) => [
  {
    key: 'wallet_balance',
    labelKey: '钱包额度',
    icon: Wallet,
    color: '#10b981',
    bg: '#ecfdf5',
    format: (d) => renderQuota(d?.total_balance),
  },
  {
    key: 'subscription_balance',
    labelKey: '订阅额度',
    icon: Crown,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    format: (d) => {
      if (!d?.has_subscription) return t('无订阅');
      if (!d?.subscription_quota_total) return '∞';
      const remain =
        d.subscription_quota_total - d.subscription_quota_used;
      return renderQuota(remain);
    },
    sub: (d) => {
      if (!d?.has_subscription) return '';
      return d.subscription_plan_title || '';
    },
  },
  {
    key: 'consumed',
    labelKey: '总消耗',
    icon: TrendingDown,
    color: '#ef4444',
    bg: '#fef2f2',
    format: (d) => renderQuota(d?.total_consumed),
  },
  {
    key: 'requests',
    labelKey: '总请求',
    icon: Server,
    color: '#3b82f6',
    bg: '#eff6ff',
    format: (d) => formatNumber(d?.total_requests),
  },
  {
    key: 'tokens',
    labelKey: '总Tokens',
    icon: Crown,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    format: (d) => formatNumber(d?.total_tokens),
  },
];

const StatMiniCards = ({ data, loading, isAdmin, t }) => {
  const cards = isAdmin ? ADMIN_CARDS : USER_CARDS(t);
  const gridCols = isAdmin
    ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-8'
    : 'grid-cols-2 md:grid-cols-5';

  return (
    <div className={`grid ${gridCols} gap-3 mb-4`}>
      {cards.map((card) => {
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
                  width: 40,
                  height: 40,
                  backgroundColor: card.bg,
                }}
              >
                <Icon size={18} color={card.color} />
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
                      style={{ width: 60, height: 20, marginTop: 2 }}
                    />
                  }
                >
                  <div className='text-lg font-bold truncate'>
                    {card.format(data)}
                  </div>
                </Skeleton>
                {card.sub && (
                  <div className='text-[10px] text-semi-color-text-3 truncate'>
                    {card.sub(data, t)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default StatMiniCards;
