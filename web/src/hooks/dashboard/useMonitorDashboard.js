import { useState, useCallback, useEffect } from 'react';
import { API, isAdmin, showError } from '../../helpers';

export const useMonitorDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState({ start: null, end: null });
  const isAdminUser = isAdmin();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = isAdminUser
        ? '/api/dashboard/overview'
        : '/api/dashboard/overview/self';
      const params = new URLSearchParams();
      if (timeRange.start) {
        params.append(
          'start_timestamp',
          String(Math.floor(timeRange.start.getTime() / 1000)),
        );
      }
      if (timeRange.end) {
        params.append(
          'end_timestamp',
          String(Math.floor(timeRange.end.getTime() / 1000)),
        );
      }
      const qs = params.toString();
      if (qs) url += '?' + qs;
      const res = await API.get(url);
      if (res.data.success) {
        setData(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdminUser, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    refresh: fetchData,
    isAdminUser,
    timeRange,
    setTimeRange,
  };
};
