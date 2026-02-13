import React from 'react';
import { Tag, Button, Space, Dropdown } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
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

export const getAdminTicketsColumns = ({
  t,
  openDetail,
  updateTicketStatus,
  deleteTicket,
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
      title: t('提交用户'),
      dataIndex: 'username',
      width: 120,
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
      title: t('更新时间'),
      dataIndex: 'updated_time',
      width: 160,
      render: (text) => <>{timestamp2string(text)}</>,
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 180,
      render: (text, record) => {
        const moreMenuItems = [];

        if (record.status !== TICKET_STATUS.IN_PROGRESS) {
          moreMenuItems.push({
            node: 'item',
            name: t('处理中'),
            onClick: () => updateTicketStatus(record.id, TICKET_STATUS.IN_PROGRESS),
          });
        }
        if (record.status !== TICKET_STATUS.RESOLVED) {
          moreMenuItems.push({
            node: 'item',
            name: t('已解决'),
            onClick: () => updateTicketStatus(record.id, TICKET_STATUS.RESOLVED),
          });
        }
        if (record.status !== TICKET_STATUS.CLOSED) {
          moreMenuItems.push({
            node: 'item',
            name: t('已关闭'),
            onClick: () => updateTicketStatus(record.id, TICKET_STATUS.CLOSED),
          });
        }
        moreMenuItems.push({
          node: 'item',
          name: t('删除工单'),
          type: 'danger',
          onClick: () => deleteTicket(record.id),
        });

        return (
          <Space>
            <Button
              type='tertiary'
              size='small'
              onClick={() => openDetail(record)}
            >
              {t('工单详情')}
            </Button>
            <Dropdown
              trigger='click'
              position='bottomRight'
              menu={moreMenuItems}
            >
              <Button type='tertiary' size='small' icon={<IconMore />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];
};
