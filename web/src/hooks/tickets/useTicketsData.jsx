import { useState, useEffect } from 'react';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { TICKET_STATUS } from '../../constants/ticket.constants';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useTicketsData = () => {
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

  // Create state
  const [showCreate, setShowCreate] = useState(false);

  // Form API
  const [formApi, setFormApi] = useState(null);

  // UI state
  const [compactMode, setCompactMode] = useTableCompactMode('tickets');

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
  const loadTickets = async (page = 1, size = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/ticket/self?p=${page}&page_size=${size}`,
      );
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
      await loadTickets(1, pageSize);
      return;
    }

    setSearching(true);
    try {
      const res = await API.get(
        `/api/ticket/self/search?keyword=${searchKeyword}&p=1&page_size=${pageSize}`,
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

  // Close ticket
  const closeTicket = async (id) => {
    Modal.confirm({
      title: t('确认关闭该工单？'),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await API.post(`/api/ticket/${id}/close`);
          const { success, message } = res.data;
          if (success) {
            showSuccess(t('工单已关闭'));
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
      await loadTickets(page, pageSize);
    } else {
      await searchTickets();
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadTickets(page, pageSize);
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
      loadTickets(1, size);
    } else {
      searchTickets();
    }
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

  // Close create
  const closeCreate = () => {
    setShowCreate(false);
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

    // Create state
    showCreate,

    // Form state
    formApi,
    formInitValues,

    // UI state
    compactMode,
    setCompactMode,

    // Data operations
    loadTickets,
    searchTickets,
    closeTicket,
    refresh,

    // State updates
    setActivePage,
    setPageSize,
    setFormApi,
    setShowCreate,
    setShowDetail,
    setDetailTicket,

    // Event handlers
    handlePageChange,
    handlePageSizeChange,
    openDetail,
    closeDetail,
    closeCreate,
    getFormValues,

    // Translation
    t,
  };
};
