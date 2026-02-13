import React from 'react';
import CardPro from '../../common/ui/CardPro';
import TicketsTable from './TicketsTable';
import TicketsActions from './TicketsActions';
import TicketsFilters from './TicketsFilters';
import TicketsDescription from './TicketsDescription';
import TicketDetailModal from './modals/TicketDetailModal';
import CreateTicketModal from './modals/CreateTicketModal';
import { useTicketsData } from '../../../hooks/tickets/useTicketsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const TicketsPage = () => {
  const ticketsData = useTicketsData();
  const isMobile = useIsMobile();

  const {
    // Detail state
    showDetail,
    detailTicket,
    closeDetail,

    // Create state
    showCreate,
    closeCreate,
    setShowCreate,

    // Filters state
    formInitValues,
    setFormApi,
    searchTickets,
    loading,
    searching,

    // UI state
    compactMode,
    setCompactMode,

    // Data operations
    refresh,

    // Translation
    t,
  } = ticketsData;

  return (
    <>
      <TicketDetailModal
        visible={showDetail}
        ticket={detailTicket}
        onClose={closeDetail}
        refresh={refresh}
      />

      <CreateTicketModal
        visible={showCreate}
        onClose={closeCreate}
        refresh={refresh}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <TicketsDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <TicketsActions
              setShowCreate={setShowCreate}
              t={t}
            />

            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
              <TicketsFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchTickets={searchTickets}
                loading={loading}
                searching={searching}
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
        <TicketsTable {...ticketsData} />
      </CardPro>
    </>
  );
};

export default TicketsPage;
