import React from 'react';
import CardPro from '../../common/ui/CardPro';
import AdminTicketsTable from './AdminTicketsTable';
import AdminTicketsFilters from './AdminTicketsFilters';
import AdminTicketsDescription from './AdminTicketsDescription';
import AdminTicketDetailModal from './modals/AdminTicketDetailModal';
import { useAdminTicketsData } from '../../../hooks/tickets/useAdminTicketsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const AdminTicketsPage = () => {
  const ticketsData = useAdminTicketsData();
  const isMobile = useIsMobile();

  const {
    // Detail state
    showDetail,
    detailTicket,
    closeDetail,

    // Filters state
    formInitValues,
    setFormApi,
    searchTickets,
    loading,
    searching,
    filterStatus,
    filterPriority,
    handleFilterStatusChange,
    handleFilterPriorityChange,

    // UI state
    compactMode,
    setCompactMode,

    // Data operations
    refresh,
    updateTicketStatus,

    // Translation
    t,
  } = ticketsData;

  return (
    <>
      <AdminTicketDetailModal
        visible={showDetail}
        ticket={detailTicket}
        onClose={closeDetail}
        refresh={refresh}
        updateTicketStatus={updateTicketStatus}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <AdminTicketsDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <div className='w-full md:w-full lg:w-auto'>
              <AdminTicketsFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchTickets={searchTickets}
                loading={loading}
                searching={searching}
                filterStatus={filterStatus}
                filterPriority={filterPriority}
                handleFilterStatusChange={handleFilterStatusChange}
                handleFilterPriorityChange={handleFilterPriorityChange}
                t={t}
              />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: ticketsData.activePage,
          pageSize: ticketsData.pageSize,
          total: ticketsData.tokenCount,
          onPageChange: ticketsData.handlePageChange,
          onPageSizeChange: ticketsData.handlePageSizeChange,
          isMobile: isMobile,
          t: ticketsData.t,
        })}
        t={ticketsData.t}
      >
        <AdminTicketsTable {...ticketsData} />
      </CardPro>
    </>
  );
};

export default AdminTicketsPage;
