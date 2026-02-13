import React from 'react';
import { Card, Skeleton } from '@douyinfe/semi-ui';
import { renderQuota } from '../../helpers';
import { PERIOD_CARDS, formatNumber } from '../../constants/monitor.constants';

const PeriodSummaryCards = ({ data, loading, isAdmin, t }) => {
  const periodMap = {
    today: data?.period_today,
    week: data?.period_week,
    month: data?.period_month,
  };

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-3 mb-4'>
      {PERIOD_CARDS.map((card) => {
        const period = periodMap[card.key];
        return (
          <Card
            key={card.key}
            bodyStyle={{
              padding: '20px 24px',
              background: card.gradient,
              borderRadius: 16,
            }}
            className='!rounded-2xl border-0 shadow-sm overflow-hidden'
          >
            <div
              className='text-lg font-bold mb-3'
              style={{ color: card.accentColor }}
            >
              {t(card.labelKey)}
            </div>
            <div className='grid grid-cols-2 gap-y-3 gap-x-6'>
              {isAdmin && (
                <div>
                  <div
                    className='text-xs mb-0.5'
                    style={{ color: card.accentColor, opacity: 0.7 }}
                  >
                    {t('充值')}
                  </div>
                  <Skeleton
                    loading={loading}
                    active
                    placeholder={
                      <Skeleton.Paragraph
                        rows={1}
                        style={{ width: 60, height: 18 }}
                      />
                    }
                  >
                    <div
                      className='text-base font-bold'
                      style={{ color: card.textColor }}
                    >
                      {'$' + (period?.topup || 0).toFixed(2)}
                    </div>
                  </Skeleton>
                </div>
              )}
              <div>
                <div
                  className='text-xs mb-0.5'
                  style={{ color: card.accentColor, opacity: 0.7 }}
                >
                  {t('消耗')}
                </div>
                <Skeleton
                  loading={loading}
                  active
                  placeholder={
                    <Skeleton.Paragraph
                      rows={1}
                      style={{ width: 60, height: 18 }}
                    />
                  }
                >
                  <div
                    className='text-base font-bold'
                    style={{ color: card.textColor }}
                  >
                    {renderQuota(period?.consumed)}
                  </div>
                </Skeleton>
              </div>
              <div>
                <div
                  className='text-xs mb-0.5'
                  style={{ color: card.accentColor, opacity: 0.7 }}
                >
                  {t('请求')}
                </div>
                <Skeleton
                  loading={loading}
                  active
                  placeholder={
                    <Skeleton.Paragraph
                      rows={1}
                      style={{ width: 50, height: 18 }}
                    />
                  }
                >
                  <div
                    className='text-base font-bold'
                    style={{ color: card.textColor }}
                  >
                    {formatNumber(period?.requests)}
                  </div>
                </Skeleton>
              </div>
              <div>
                <div
                  className='text-xs mb-0.5'
                  style={{ color: card.accentColor, opacity: 0.7 }}
                >
                  Tokens
                </div>
                <Skeleton
                  loading={loading}
                  active
                  placeholder={
                    <Skeleton.Paragraph
                      rows={1}
                      style={{ width: 50, height: 18 }}
                    />
                  }
                >
                  <div
                    className='text-base font-bold'
                    style={{ color: card.textColor }}
                  >
                    {formatNumber(period?.tokens)}
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

export default PeriodSummaryCards;
