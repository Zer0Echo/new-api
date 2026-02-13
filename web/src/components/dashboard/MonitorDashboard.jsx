import React, { useContext, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMonitorDashboard } from '../../hooks/dashboard/useMonitorDashboard';
import { StatusContext } from '../../context/Status';
import { API, showError, getRelativeTime } from '../../helpers';
import MonitorHeader from './MonitorHeader';
import StatMiniCards from './StatMiniCards';
import PerformanceCards from './PerformanceCards';
import PeriodSummaryCards from './PeriodSummaryCards';
import TrendChartPanels from './TrendChartPanels';
import DistributionPanels from './DistributionPanels';
import ModelConsumptionChart from './ModelConsumptionChart';
import ApiInfoPanel from './ApiInfoPanel';
import AnnouncementsPanel from './AnnouncementsPanel';
import FaqPanel from './FaqPanel';
import UptimePanel from './UptimePanel';

import {
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  ILLUSTRATION_SIZE,
  ANNOUNCEMENT_LEGEND_DATA,
  UPTIME_STATUS_MAP,
} from '../../constants/dashboard.constants';
import {
  handleCopyUrl,
  handleSpeedTest,
  getUptimeStatusColor,
  getUptimeStatusText,
  renderMonitorList,
} from '../../helpers/dashboard';

const MonitorDashboard = () => {
  const { data, loading, refresh, isAdminUser, timeRange, setTimeRange } =
    useMonitorDashboard();
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);

  // Uptime state
  const [uptimeData, setUptimeData] = useState([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [activeUptimeTab, setActiveUptimeTab] = useState('');

  const loadUptimeData = useCallback(async () => {
    setUptimeLoading(true);
    try {
      const res = await API.get('/api/uptime/status');
      const { success, message, data: respData } = res.data;
      if (success) {
        setUptimeData(respData || []);
        if (respData && respData.length > 0 && !activeUptimeTab) {
          setActiveUptimeTab(respData[0].categoryName);
        }
      } else {
        showError(message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUptimeLoading(false);
    }
  }, [activeUptimeTab]);

  useEffect(() => {
    loadUptimeData();
  }, []);

  // Panel enable flags from system settings
  const apiInfoEnabled = statusState?.status?.api_info_enabled ?? true;
  const announcementsEnabled =
    statusState?.status?.announcements_enabled ?? true;
  const faqEnabled = statusState?.status?.faq_enabled ?? true;
  const uptimeEnabled = statusState?.status?.uptime_kuma_enabled ?? true;

  const hasApiInfoPanel = apiInfoEnabled;
  const hasInfoPanels = announcementsEnabled || faqEnabled || uptimeEnabled;

  // Prepare data for bottom panels
  const apiInfoData = statusState?.status?.api_info || [];
  const announcementData = (statusState?.status?.announcements || []).map(
    (item) => {
      const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
      const absoluteTime =
        pubDate && !isNaN(pubDate.getTime())
          ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')} ${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`
          : item?.publishDate || '';
      const relativeTime = getRelativeTime(item.publishDate);
      return {
        ...item,
        time: absoluteTime,
        relative: relativeTime,
      };
    },
  );
  const faqData = statusState?.status?.faq || [];

  const uptimeLegendData = Object.entries(UPTIME_STATUS_MAP).map(
    ([status, info]) => ({
      status: Number(status),
      color: info.color,
      label: t(info.label),
    }),
  );

  return (
    <div className='h-full'>
      <MonitorHeader
        isAdmin={isAdminUser}
        onRefresh={refresh}
        loading={loading}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        t={t}
      />
      <StatMiniCards
        data={data}
        loading={loading}
        isAdmin={isAdminUser}
        t={t}
      />
      <PerformanceCards data={data} loading={loading} t={t} />
      <PeriodSummaryCards
        data={data}
        loading={loading}
        isAdmin={isAdminUser}
        t={t}
      />

      {/* Model Consumption Distribution Chart */}
      <div className='mb-4'>
        <ModelConsumptionChart t={t} />
      </div>

      <TrendChartPanels
        data={data}
        loading={loading}
        isAdmin={isAdminUser}
        timeRange={timeRange}
        t={t}
      />
      <DistributionPanels
        data={data}
        loading={loading}
        isAdmin={isAdminUser}
        timeRange={timeRange}
        t={t}
      />

      {/* API Info Panel */}
      {hasApiInfoPanel && (
        <div className='mb-4'>
          <ApiInfoPanel
            apiInfoData={apiInfoData}
            handleCopyUrl={(url) => handleCopyUrl(url, t)}
            handleSpeedTest={handleSpeedTest}
            CARD_PROPS={CARD_PROPS}
            FLEX_CENTER_GAP2={FLEX_CENTER_GAP2}
            ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
            t={t}
          />
        </div>
      )}

      {/* Announcements, FAQ, Uptime panels */}
      {hasInfoPanels && (
        <div className='mb-4'>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-4'>
            {announcementsEnabled && (
              <AnnouncementsPanel
                announcementData={announcementData}
                announcementLegendData={ANNOUNCEMENT_LEGEND_DATA.map(
                  (item) => ({
                    ...item,
                    label: t(item.label),
                  }),
                )}
                CARD_PROPS={CARD_PROPS}
                ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
                t={t}
              />
            )}

            {faqEnabled && (
              <FaqPanel
                faqData={faqData}
                CARD_PROPS={CARD_PROPS}
                FLEX_CENTER_GAP2={FLEX_CENTER_GAP2}
                ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
                t={t}
              />
            )}

            {uptimeEnabled && (
              <UptimePanel
                uptimeData={uptimeData}
                uptimeLoading={uptimeLoading}
                activeUptimeTab={activeUptimeTab}
                setActiveUptimeTab={setActiveUptimeTab}
                loadUptimeData={loadUptimeData}
                uptimeLegendData={uptimeLegendData}
                renderMonitorList={(monitors) =>
                  renderMonitorList(
                    monitors,
                    (status) => getUptimeStatusColor(status, UPTIME_STATUS_MAP),
                    (status) =>
                      getUptimeStatusText(status, UPTIME_STATUS_MAP, t),
                    t,
                  )
                }
                CARD_PROPS={CARD_PROPS}
                ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
                t={t}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorDashboard;
