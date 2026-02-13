import React from 'react';
import { Button, DatePicker, Tag } from '@douyinfe/semi-ui';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MonitorHeader = ({
  isAdmin,
  onRefresh,
  loading,
  timeRange,
  onTimeRangeChange,
  t,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('overview');

  const hasCustomRange = timeRange?.start && timeRange?.end;

  return (
    <div className='mb-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div>
            <h2 className='text-2xl font-bold text-semi-color-text-0 m-0'>
              {isAdmin ? t('监控大屏') : t('数据看板')}
            </h2>
            <p className='text-xs text-semi-color-text-2 mt-0.5 mb-0'>
              {isAdmin
                ? t('实时数据监控与分析')
                : t('个人数据概览')}
            </p>
          </div>
          {isAdmin && (
            <div className='flex gap-1 ml-2'>
              <Tag
                color={activeTab === 'overview' ? 'blue' : 'white'}
                size='large'
                shape='circle'
                className='cursor-pointer'
                onClick={() => setActiveTab('overview')}
              >
                {t('概览')}
              </Tag>
              <Tag
                color={activeTab === 'users' ? 'blue' : 'white'}
                size='large'
                shape='circle'
                className='cursor-pointer'
                onClick={() => {
                  setActiveTab('users');
                  navigate('/console/user');
                }}
              >
                {t('用户列表')}
              </Tag>
            </div>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <DatePicker
            type='dateTime'
            density='compact'
            style={{ width: 190 }}
            placeholder={t('开始时间')}
            value={timeRange?.start || undefined}
            disabledDate={(date) => {
              if (!timeRange?.end) return false;
              return date && date.getTime() > new Date(timeRange.end).getTime();
            }}
            onChange={(date) => {
              if (date && timeRange?.end && new Date(date).getTime() > new Date(timeRange.end).getTime()) return;
              onTimeRangeChange({ ...timeRange, start: date || null });
            }}
          />
          <span className='text-semi-color-text-2 text-xs'>~</span>
          <DatePicker
            type='dateTime'
            density='compact'
            style={{ width: 190 }}
            placeholder={t('结束时间')}
            value={timeRange?.end || undefined}
            disabledDate={(date) => {
              if (!timeRange?.start) return false;
              return date && date.getTime() < new Date(timeRange.start).getTime();
            }}
            onChange={(date) => {
              if (date && timeRange?.start && new Date(date).getTime() < new Date(timeRange.start).getTime()) return;
              onTimeRangeChange({ ...timeRange, end: date || null });
            }}
          />
          {hasCustomRange && (
            <Button
              type='tertiary'
              icon={<RotateCcw size={14} />}
              onClick={() => onTimeRangeChange({ start: null, end: null })}
              className='!rounded-full'
              size='small'
            />
          )}
          <Button
            theme='solid'
            icon={<RefreshCw size={14} />}
            onClick={onRefresh}
            loading={loading}
            className='!rounded-full'
          >
            {t('刷新')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MonitorHeader;
