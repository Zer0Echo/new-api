import React, { useRef } from 'react';
import { Form, Button, Select } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import {
  TICKET_STATUS,
  TICKET_PRIORITY,
} from '../../../constants/ticket.constants';

const AdminTicketsFilters = ({
  formInitValues,
  setFormApi,
  searchTickets,
  loading,
  searching,
  filterStatus,
  filterPriority,
  handleFilterStatusChange,
  handleFilterPriorityChange,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    handleFilterStatusChange(0);
    handleFilterPriorityChange(0);
    setTimeout(() => {
      searchTickets();
    }, 100);
  };

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={searchTickets}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <Select
          value={filterStatus}
          onChange={handleFilterStatusChange}
          size='small'
          style={{ width: 120 }}
          placeholder={t('工单状态')}
        >
          <Select.Option value={0}>{t('全部状态')}</Select.Option>
          <Select.Option value={TICKET_STATUS.OPEN}>{t('开放')}</Select.Option>
          <Select.Option value={TICKET_STATUS.IN_PROGRESS}>{t('处理中')}</Select.Option>
          <Select.Option value={TICKET_STATUS.RESOLVED}>{t('已解决')}</Select.Option>
          <Select.Option value={TICKET_STATUS.CLOSED}>{t('已关闭')}</Select.Option>
        </Select>
        <Select
          value={filterPriority}
          onChange={handleFilterPriorityChange}
          size='small'
          style={{ width: 120 }}
          placeholder={t('工单优先级')}
        >
          <Select.Option value={0}>{t('全部优先级')}</Select.Option>
          <Select.Option value={TICKET_PRIORITY.LOW}>{t('低')}</Select.Option>
          <Select.Option value={TICKET_PRIORITY.MEDIUM}>{t('中')}</Select.Option>
          <Select.Option value={TICKET_PRIORITY.HIGH}>{t('高')}</Select.Option>
          <Select.Option value={TICKET_PRIORITY.CRITICAL}>{t('紧急')}</Select.Option>
        </Select>
        <div className='relative w-full md:w-64'>
          <Form.Input
            field='searchKeyword'
            prefix={<IconSearch />}
            placeholder={t('关键字(id或者名称)')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            onClick={handleReset}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default AdminTicketsFilters;
