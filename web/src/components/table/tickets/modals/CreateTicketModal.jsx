import React, { useState } from 'react';
import { SideSheet, Form, Select, Button } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';
import { TICKET_PRIORITY } from '../../../../constants/ticket.constants';
import { useTranslation } from 'react-i18next';

const CreateTicketModal = ({ visible, onClose, refresh }) => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const res = await API.post('/api/ticket/', {
        title: values.title,
        description: values.description,
        priority: values.priority || TICKET_PRIORITY.MEDIUM,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('工单创建成功'));
        onClose();
        await refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSubmitting(false);
  };

  return (
    <SideSheet
      title={t('创建工单')}
      visible={visible}
      onCancel={onClose}
      placement='right'
      width={500}
    >
      <Form onSubmit={handleSubmit} className='p-4'>
        <Form.Input
          field='title'
          label={t('工单标题')}
          placeholder={t('请输入工单标题')}
          rules={[{ required: true, message: t('工单标题') }]}
        />
        <Form.Select
          field='priority'
          label={t('工单优先级')}
          initValue={TICKET_PRIORITY.MEDIUM}
          style={{ width: '100%' }}
        >
          <Select.Option value={TICKET_PRIORITY.LOW}>
            {t('低')}
          </Select.Option>
          <Select.Option value={TICKET_PRIORITY.MEDIUM}>
            {t('中')}
          </Select.Option>
          <Select.Option value={TICKET_PRIORITY.HIGH}>
            {t('高')}
          </Select.Option>
          <Select.Option value={TICKET_PRIORITY.CRITICAL}>
            {t('紧急')}
          </Select.Option>
        </Form.Select>
        <Form.TextArea
          field='description'
          label={t('工单描述')}
          placeholder={t('请输入工单描述')}
          autosize={{ minRows: 4, maxRows: 10 }}
          rules={[{ required: true, message: t('工单描述') }]}
        />
        <div className='flex justify-end mt-4'>
          <Button
            type='primary'
            htmlType='submit'
            loading={submitting}
          >
            {t('创建工单')}
          </Button>
        </div>
      </Form>
    </SideSheet>
  );
};

export default CreateTicketModal;
