import React, { useState, useEffect, useRef } from 'react';
import { SideSheet, Tag, Input, Button, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';
import {
  TICKET_STATUS,
  TICKET_STATUS_MAP,
  TICKET_PRIORITY_MAP,
} from '../../../../constants/ticket.constants';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const TicketDetailModal = ({ visible, ticket, onClose, refresh }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const loadMessages = async () => {
    if (!ticket) return;
    setLoadingMessages(true);
    try {
      const res = await API.get(`/api/ticket/${ticket.id}/messages`);
      const { success, message, data } = res.data;
      if (success) {
        setMessages(data || []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoadingMessages(false);
  };

  useEffect(() => {
    if (visible && ticket) {
      loadMessages();
      setReplyContent('');
    }
  }, [visible, ticket]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      const res = await API.post(`/api/ticket/${ticket.id}/messages`, {
        content: replyContent,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('回复发送成功'));
        setReplyContent('');
        await loadMessages();
        if (refresh) await refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!ticket) return null;

  const statusConfig = TICKET_STATUS_MAP[ticket.status];
  const priorityConfig = TICKET_PRIORITY_MAP[ticket.priority];
  const isClosed = ticket.status === TICKET_STATUS.CLOSED;

  return (
    <SideSheet
      title={t('工单详情')}
      visible={visible}
      onCancel={onClose}
      placement='right'
      width={600}
    >
      <div className='flex flex-col h-full'>
        {/* Header */}
        <div className='p-4 border-b'>
          <h3 className='text-lg font-medium mb-2'>{ticket.title}</h3>
          <div className='flex items-center gap-2 mb-2'>
            {statusConfig && (
              <Tag color={statusConfig.color} shape='circle'>
                {t(statusConfig.text)}
              </Tag>
            )}
            {priorityConfig && (
              <Tag color={priorityConfig.color} shape='circle'>
                {t(priorityConfig.text)}
              </Tag>
            )}
            <Text type='tertiary' size='small'>
              {timestamp2string(ticket.created_time)}
            </Text>
          </div>
          {ticket.description && (
            <div className='mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
              <Text>{ticket.description}</Text>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className='flex-1 overflow-y-auto p-4' style={{ maxHeight: 'calc(100vh - 350px)' }}>
          {loadingMessages ? (
            <div className='flex justify-center py-8'>
              <Spin />
            </div>
          ) : messages.length === 0 ? (
            <div className='text-center py-8'>
              <Text type='tertiary'>{t('暂无消息')}</Text>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.is_admin
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <Text size='small' strong>
                      {msg.username || (msg.is_admin ? t('管理员') : t('我'))}
                    </Text>
                    {msg.is_admin && (
                      <Tag color='blue' size='small'>
                        {t('管理员')}
                      </Tag>
                    )}
                    <Text type='tertiary' size='small'>
                      {timestamp2string(msg.created_time)}
                    </Text>
                  </div>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        {!isClosed && (
          <div className='p-4 border-t'>
            <div className='flex gap-2'>
              <Input
                value={replyContent}
                onChange={setReplyContent}
                onKeyDown={handleKeyDown}
                placeholder={t('请输入回复内容')}
                disabled={sending}
              />
              <Button
                type='primary'
                onClick={handleSend}
                loading={sending}
                disabled={!replyContent.trim()}
              >
                {t('发送')}
              </Button>
            </div>
          </div>
        )}
        {isClosed && (
          <div className='p-4 border-t text-center'>
            <Text type='tertiary'>{t('已关闭')}</Text>
          </div>
        )}
      </div>
    </SideSheet>
  );
};

export default TicketDetailModal;
