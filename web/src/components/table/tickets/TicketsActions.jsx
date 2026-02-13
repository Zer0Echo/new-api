import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const TicketsActions = ({ setShowCreate, t }) => {
  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={() => setShowCreate(true)}
        size='small'
      >
        {t('创建工单')}
      </Button>
    </div>
  );
};

export default TicketsActions;
