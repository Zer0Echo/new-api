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

import React from 'react';
import { Button, Modal } from '@douyinfe/semi-ui';

const RedemptionsActions = ({
  selectedKeys,
  setEditingRedemption,
  setShowEdit,
  batchCopyRedemptions,
  batchDeleteRedemptions,
  batchDeleteSelectedRedemptions,
  batchUpdateStatusRedemptions,
  batchExportRedemptions,
  t,
}) => {
  // Add new redemption code
  const handleAddRedemption = () => {
    setEditingRedemption({
      id: undefined,
    });
    setShowEdit(true);
  };

  const handleBatchDeleteSelected = () => {
    if (selectedKeys.length === 0) return;
    Modal.confirm({
      title: t('批量删除兑换码'),
      content: t('确定要删除所选的 {{count}} 个兑换码吗？', { count: selectedKeys.length }) + ' ' + t('此操作不可撤销'),
      okType: 'danger',
      onOk: batchDeleteSelectedRedemptions,
    });
  };

  const handleBatchDisable = () => {
    if (selectedKeys.length === 0) return;
    Modal.confirm({
      title: t('批量禁用兑换码'),
      content: t('确定要禁用所选的 {{count}} 个兑换码吗？', { count: selectedKeys.length }),
      onOk: () => batchUpdateStatusRedemptions('disable'),
    });
  };

  const handleBatchEnable = () => {
    if (selectedKeys.length === 0) return;
    Modal.confirm({
      title: t('批量启用兑换码'),
      content: t('确定要启用所选的 {{count}} 个兑换码吗？', { count: selectedKeys.length }),
      onOk: () => batchUpdateStatusRedemptions('enable'),
    });
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={handleAddRedemption}
        size='small'
      >
        {t('添加兑换码')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={batchCopyRedemptions}
        size='small'
      >
        {t('复制所选兑换码到剪贴板')}
      </Button>

      <Button
        type='danger'
        className='flex-1 md:flex-initial'
        onClick={handleBatchDeleteSelected}
        size='small'
      >
        {t('删除所选兑换码')}
      </Button>

      <Button
        type='warning'
        className='flex-1 md:flex-initial'
        onClick={handleBatchDisable}
        size='small'
      >
        {t('禁用所选兑换码')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={handleBatchEnable}
        size='small'
      >
        {t('启用所选兑换码')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={batchExportRedemptions}
        size='small'
      >
        {t('导出所选兑换码')}
      </Button>

      <Button
        type='danger'
        className='w-full md:w-auto'
        onClick={batchDeleteRedemptions}
        size='small'
      >
        {t('清除失效兑换码')}
      </Button>
    </div>
  );
};

export default RedemptionsActions;
