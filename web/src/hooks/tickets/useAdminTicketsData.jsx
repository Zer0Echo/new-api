import { useState, useEffect } from 'react';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { TICKET_STATUS, TICKET_PRIORITY } from '../../constants/ticket.constants';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useAdminTicketsData = () => {
  const { t } = useTranslation();

  // Basic state
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [tokenCount, setTokenCount] = useState(0);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState(0);
  const [filterPriority, setFilterPriority] = useState(0);

  // Form API
  const [formApi, setFormApi] = useState(null);

  // UI state
  const [compactMode, setCompactMode] = useTableCompactMode('admin-tickets');

  // Form state
  const formInitValues = {
    searchKeyword: '',
  };

  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
    };
  };

  // Load tickets
  const loadTickets = async (page = 1, size = pageSize, status = filterStatus, priority = filterPriority) => {
    setLoading(true);
    try {
      let url = `/api/ticket/?p=${page}&page_size=${size}`;
      if (status > 0) url += `&status=${status}`;
      if (priority > 0) url += `&priority=${priority}`;
      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setActivePage(data.page <= 0 ? 1 : data.page);
        setTokenCount(data.total);
        setTickets(data.items || []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  // Search tickets
  const searchTickets = async () => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadTickets(1, pageSize, filterStatus, filterPriority);
      return;
    }

    setSearching(true);
    try {
      const res = await API.get(
        `/api/ticket/search?keyword=${searchKeyword}&p=1&page_size=${pageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setActivePage(data.page || 1);
        setTokenCount(data.total);
        setTickets(data.items || []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSearching(false);
  };

  // Update ticket status
  const updateTicketStatus = async (id, status) => {
    setLoading(true);
    try {
      const res = await API.put('/api/ticket/', { id, status });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        await refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  // Delete ticket
  const deleteTicket = async (id) => {
    Modal.confirm({
      title: t('确认删除该工单？'),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await API.delete(`/api/ticket/${id}`);
          const { success, message } = res.data;
          if (success) {
            showSuccess(t('工单已删除'));
            await refresh();
          } else {
            showError(message);
          }
        } catch (error) {
          showError(error.message);
        }
        setLoading(false);
      },
    });
  };

  // Refresh data
  const refresh = async (page = activePage) => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadTickets(page, pageSize, filterStatus, filterPriority);
    } else {
      await searchTickets();
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadTickets(page, pageSize, filterStatus, filterPriority);
    } else {
      searchTickets();
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadTickets(1, size, filterStatus, filterPriority);
    } else {
      searchTickets();
    }
  };

  // Handle filter change
  const handleFilterStatusChange = (val) => {
    setFilterStatus(val);
    setActivePage(1);
    loadTickets(1, pageSize, val, filterPriority);
  };

  const handleFilterPriorityChange = (val) => {
    setFilterPriority(val);
    setActivePage(1);
    loadTickets(1, pageSize, filterStatus, val);
  };

  // Open detail
  const openDetail = (ticket) => {
    setDetailTicket(ticket);
    setShowDetail(true);
  };

  // Close detail
  const closeDetail = () => {
    setShowDetail(false);
    setTimeout(() => {
      setDetailTicket(null);
    }, 300);
  };

  // Initialize
  useEffect(() => {
    loadTickets(1, pageSize).catch((reason) => {
      showError(reason);
    });
  }, [pageSize]);

  return {
    // Data state
    tickets,
    loading,
    searching,
    activePage,
    pageSize,
    tokenCount,

    // Detail state
    showDetail,
    detailTicket,

    // Filter state
    filterStatus,
    filterPriority,

    // Form state
    formApi,
    formInitValues,

    // UI state
    compactMode,
    setCompactMode,

    // Data operations
    loadTickets,
    searchTickets,
    updateTicketStatus,
    deleteTicket,
    refresh,

    // State updates
    setActivePage,
    setPageSize,
    setFormApi,
    setShowDetail,
    setDetailTicket,

    // Event handlers
    handlePageChange,
    handlePageSizeChange,
    handleFilterStatusChange,
    handleFilterPriorityChange,
    openDetail,
    closeDetail,
    getFormValues,

    // Translation
    t,
  };
};
