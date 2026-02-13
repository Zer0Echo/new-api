/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useRef } from 'react';
import {
  Avatar,
  Typography,
  Card,
  Button,
  Form,
} from '@douyinfe/semi-ui';
import { IconGift } from '@douyinfe/semi-icons';
import { Ticket } from 'lucide-react';

const RedemptionCodeCard = ({
  t,
  redemptionCode,
  setRedemptionCode,
  topUp,
  isSubmitting,
  topUpLink,
  openTopUpLink,
}) => {
  const formApiRef = useRef(null);

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='green' className='mr-3 shadow-md'>
          <Ticket size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('兑换码')}
          </Typography.Text>
          <div className='text-xs'>
            {t('使用兑换码充值余额或激活订阅')}
          </div>
        </div>
      </div>

      <Form
        getFormApi={(api) => (formApiRef.current = api)}
        initValues={{ redemptionCode: redemptionCode }}
      >
        <Form.Input
          field='redemptionCode'
          noLabel={true}
          placeholder={t('请输入兑换码')}
          value={redemptionCode}
          onChange={(value) => setRedemptionCode(value)}
          prefix={<IconGift />}
          suffix={
            <div className='flex items-center gap-2'>
              <Button
                type='primary'
                theme='solid'
                onClick={topUp}
                loading={isSubmitting}
              >
                {t('兑换')}
              </Button>
            </div>
          }
          showClear
          style={{ width: '100%' }}
          extraText={
            topUpLink && (
              <Typography.Text type='tertiary'>
                {t('在找兑换码？')}
                <Typography.Text
                  type='secondary'
                  underline
                  className='cursor-pointer'
                  onClick={openTopUpLink}
                >
                  {t('购买兑换码')}
                </Typography.Text>
              </Typography.Text>
            )
          }
        />
      </Form>
    </Card>
  );
};

export default RedemptionCodeCard;
