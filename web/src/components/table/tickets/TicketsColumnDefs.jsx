import React from 'react';
import { Tag, Button, Space } from '@douyinfe/semi-ui';
import { timestamp2string } from '../../../helpers';
import {
  TICKET_STATUS,
  TICKET_STATUS_MAP,
  TICKET_PRIORITY_MAP,
} from '../../../constants/ticket.constants';

const renderStatus = (status, t) => {
  const config = TICKET_STATUS_MAP[status];
  if (config) {
    return (
      <Tag color={config.color} shape='circle'>
        {t(config.text)}
      </Tag>
    );
  }
  return (
    <Tag color='grey' shape='circle'>
      {t('未知状态')}
    </Tag>
  );
};

const renderPriority = (priority, t) => {
  const config = TICKET_PRIORITY_MAP[priority];
  if (config) {
    return (
      <Tag color={config.color} shape='circle'>
        {t(config.text)}
      </Tag>
    );
  }
  return null;
};

export const getTicketsColumns = ({
  t,
  openDetail,
  closeTicket,
}) => {
  return [
    {
      title: t('ID'),
      dataIndex: 'id',
      width: 60,
    },
    {
      title: t('工单标题'),
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: t('工单状态'),
      dataIndex: 'status',
      width: 100,
      render: (text) => renderStatus(text, t),
    },
    {
      title: t('工单优先级'),
      dataIndex: 'priority',
      width: 80,
      render: (text) => renderPriority(text, t),
    },
    {
      title: t('消息数'),
      dataIndex: 'message_count',
      width: 80,
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      width: 160,
      render: (text) => <>{timestamp2string(text)}</>,
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 150,
      render: (text, record) => {
        return (
          <Space>
            <Button
              type='tertiary'
              size='small'
              onClick={() => openDetail(record)}
            >
              {t('工单详情')}
            </Button>
            {record.status !== TICKET_STATUS.CLOSED && (
              <Button
                type='danger'
                size='small'
                onClick={() => closeTicket(record.id)}
              >
                {t('关闭工单')}
              </Button>
            )}
          </Space>
        );
      },
    },
  ];
};
