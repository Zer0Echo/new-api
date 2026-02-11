import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Button,
  InputNumber,
  Input,
  Switch,
  Tag,
  Modal,
  Form,
  Select,
  Row,
  Col,
  Card,
  Typography,
  Spin,
  Space,
  Collapsible,
  Popover,
  Empty,
  Banner,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconPlus,
  IconSave,
  IconEyeOpened,
  IconChevronDown,
  IconChevronRight,
} from '@douyinfe/semi-icons';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

export default function GroupVisualEditor(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewGroup, setPreviewGroup] = useState('');
  const [addGroupVisible, setAddGroupVisible] = useState(false);
  const [expandedModels, setExpandedModels] = useState({});

  // Parsed state from props
  const [groupRatio, setGroupRatio] = useState({});
  const [userUsableGroups, setUserUsableGroups] = useState({});
  const [groupGroupRatio, setGroupGroupRatio] = useState({});
  const [groupSpecialUsableGroup, setGroupSpecialUsableGroup] = useState({});
  const [autoGroups, setAutoGroups] = useState([]);
  const [defaultUseAutoGroup, setDefaultUseAutoGroup] = useState(false);

  // Track initial state for diff
  const [initialInputs, setInitialInputs] = useState({});

  // Section collapse state
  const [groupGroupRatioOpen, setGroupGroupRatioOpen] = useState(false);
  const [specialUsableOpen, setSpecialUsableOpen] = useState(false);

  // Parse props.options into structured state
  useEffect(() => {
    try {
      const gr = JSON.parse(props.options.GroupRatio || '{}');
      const uug = JSON.parse(props.options.UserUsableGroups || '{}');
      const ggr = JSON.parse(props.options.GroupGroupRatio || '{}');
      const gsug = JSON.parse(
        props.options['group_ratio_setting.group_special_usable_group'] || '{}',
      );
      const ag = JSON.parse(props.options.AutoGroups || '[]');
      const duag = props.options.DefaultUseAutoGroup || false;

      setGroupRatio(gr);
      setUserUsableGroups(uug);
      setGroupGroupRatio(ggr);
      setGroupSpecialUsableGroup(gsug);
      setAutoGroups(Array.isArray(ag) ? ag : []);
      setDefaultUseAutoGroup(duag);

      setInitialInputs({
        GroupRatio: props.options.GroupRatio || '{}',
        UserUsableGroups: props.options.UserUsableGroups || '{}',
        GroupGroupRatio: props.options.GroupGroupRatio || '{}',
        'group_ratio_setting.group_special_usable_group':
          props.options['group_ratio_setting.group_special_usable_group'] ||
          '{}',
        AutoGroups: props.options.AutoGroups || '[]',
        DefaultUseAutoGroup: props.options.DefaultUseAutoGroup || false,
      });
    } catch (e) {
      console.error('Failed to parse group settings:', e);
    }
  }, [props.options]);

  // Fetch preview data
  const fetchPreview = async () => {
    try {
      setPreviewLoading(true);
      const res = await API.get('/api/group/preview');
      if (res.data.success) {
        setPreviewData(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch preview:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  // All group names from GroupRatio
  const groupNames = useMemo(() => Object.keys(groupRatio).sort(), [groupRatio]);

  // Table data for Section A
  const groupTableData = useMemo(() => {
    return groupNames.map((name) => ({
      name,
      ratio: groupRatio[name],
      isUsable: name in userUsableGroups,
      description: userUsableGroups[name] || '',
      isAutoGroup: autoGroups.includes(name),
      modelCount: previewData[name]?.model_count || 0,
    }));
  }, [groupNames, groupRatio, userUsableGroups, autoGroups, previewData]);

  // GroupGroupRatio flat rows
  const groupGroupRatioRows = useMemo(() => {
    const rows = [];
    for (const userGroup in groupGroupRatio) {
      for (const targetGroup in groupGroupRatio[userGroup]) {
        rows.push({
          key: `${userGroup}-${targetGroup}`,
          userGroup,
          targetGroup,
          ratio: groupGroupRatio[userGroup][targetGroup],
        });
      }
    }
    return rows;
  }, [groupGroupRatio]);

  // GroupSpecialUsableGroup flat rows
  const specialUsableRows = useMemo(() => {
    const rows = [];
    for (const userGroup in groupSpecialUsableGroup) {
      for (const rawKey in groupSpecialUsableGroup[userGroup]) {
        const desc = groupSpecialUsableGroup[userGroup][rawKey];
        let opType = 'direct';
        let targetGroup = rawKey;
        if (rawKey.startsWith('+:')) {
          opType = 'add';
          targetGroup = rawKey.substring(2);
        } else if (rawKey.startsWith('-:')) {
          opType = 'remove';
          targetGroup = rawKey.substring(2);
        }
        rows.push({
          key: `${userGroup}-${rawKey}`,
          userGroup,
          opType,
          targetGroup,
          description: desc,
        });
      }
    }
    return rows;
  }, [groupSpecialUsableGroup]);

  // Convert state back to JSON strings for save
  const buildInputs = () => ({
    GroupRatio: JSON.stringify(groupRatio, null, 2),
    UserUsableGroups: JSON.stringify(userUsableGroups, null, 2),
    GroupGroupRatio: JSON.stringify(groupGroupRatio, null, 2),
    'group_ratio_setting.group_special_usable_group': JSON.stringify(
      groupSpecialUsableGroup,
      null,
      2,
    ),
    AutoGroups: JSON.stringify(autoGroups),
    DefaultUseAutoGroup: defaultUseAutoGroup,
  });

  // Save handler
  const handleSave = async () => {
    const currentInputs = buildInputs();
    const updateArray = compareObjects(currentInputs, initialInputs);
    if (!updateArray.length) {
      return showWarning(t('你似乎并没有修改什么'));
    }

    setLoading(true);
    try {
      const requests = updateArray.map((item) => {
        const value =
          typeof currentInputs[item.key] === 'boolean'
            ? String(currentInputs[item.key])
            : currentInputs[item.key];
        return API.put('/api/option/', { key: item.key, value });
      });

      const results = await Promise.all(requests);
      if (results.includes(undefined)) {
        return showError(
          requests.length > 1
            ? t('部分保存失败，请重试')
            : t('保存失败'),
        );
      }
      for (const res of results) {
        if (!res.data.success) {
          return showError(res.data.message);
        }
      }
      showSuccess(t('保存成功'));
      props.refresh();
      fetchPreview();
    } catch (e) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  // --- Section A handlers ---
  const updateGroupRatio = (name, value) => {
    setGroupRatio((prev) => ({ ...prev, [name]: value }));
  };

  const toggleUsable = (name, checked) => {
    setUserUsableGroups((prev) => {
      const next = { ...prev };
      if (checked) {
        next[name] = next[name] || name;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const updateUsableDescription = (name, desc) => {
    setUserUsableGroups((prev) => ({ ...prev, [name]: desc }));
  };

  const toggleAutoGroup = (name, checked) => {
    setAutoGroups((prev) => {
      if (checked) {
        return [...prev, name];
      }
      return prev.filter((g) => g !== name);
    });
  };

  const deleteGroup = (name) => {
    Modal.confirm({
      title: t('确认删除'),
      content: t('确认删除分组 {{name}}？此操作将从所有设置中移除该分组。', { name }),
      onOk: () => {
        setGroupRatio((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        setUserUsableGroups((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        setAutoGroups((prev) => prev.filter((g) => g !== name));
        // Clean groupGroupRatio
        setGroupGroupRatio((prev) => {
          const next = { ...prev };
          delete next[name];
          for (const key in next) {
            const inner = { ...next[key] };
            delete inner[name];
            if (Object.keys(inner).length === 0) {
              delete next[key];
            } else {
              next[key] = inner;
            }
          }
          return next;
        });
        // Clean groupSpecialUsableGroup
        setGroupSpecialUsableGroup((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      },
    });
  };

  const addGroup = (values) => {
    const { name, ratio, description, isUsable } = values;
    if (groupRatio[name] !== undefined) {
      return showError(t('分组已存在'));
    }
    setGroupRatio((prev) => ({ ...prev, [name]: ratio }));
    if (isUsable) {
      setUserUsableGroups((prev) => ({
        ...prev,
        [name]: description || name,
      }));
    }
    setAddGroupVisible(false);
  };

  // --- Section B handlers ---
  const addGroupGroupRatioRow = () => {
    // Add a placeholder — user picks from selects
    const userGroup = groupNames[0] || '';
    const targetGroup = groupNames[1] || groupNames[0] || '';
    if (!userGroup) return;
    setGroupGroupRatio((prev) => {
      const next = { ...prev };
      if (!next[userGroup]) next[userGroup] = {};
      next[userGroup] = { ...next[userGroup], [targetGroup]: 1 };
      return next;
    });
  };

  const updateGroupGroupRatioEntry = (
    oldUserGroup,
    oldTargetGroup,
    newUserGroup,
    newTargetGroup,
    newRatio,
  ) => {
    setGroupGroupRatio((prev) => {
      const next = { ...prev };
      // Remove old entry
      if (next[oldUserGroup]) {
        const inner = { ...next[oldUserGroup] };
        delete inner[oldTargetGroup];
        if (Object.keys(inner).length === 0) {
          delete next[oldUserGroup];
        } else {
          next[oldUserGroup] = inner;
        }
      }
      // Add new entry
      if (!next[newUserGroup]) next[newUserGroup] = {};
      next[newUserGroup] = { ...next[newUserGroup], [newTargetGroup]: newRatio };
      return next;
    });
  };

  const deleteGroupGroupRatioEntry = (userGroup, targetGroup) => {
    setGroupGroupRatio((prev) => {
      const next = { ...prev };
      if (next[userGroup]) {
        const inner = { ...next[userGroup] };
        delete inner[targetGroup];
        if (Object.keys(inner).length === 0) {
          delete next[userGroup];
        } else {
          next[userGroup] = inner;
        }
      }
      return next;
    });
  };

  // --- Section C handlers ---
  const addSpecialUsableRow = () => {
    const userGroup = groupNames[0] || '';
    if (!userGroup) return;
    setGroupSpecialUsableGroup((prev) => {
      const next = { ...prev };
      if (!next[userGroup]) next[userGroup] = {};
      // Avoid duplicate key
      let key = 'new_group';
      let i = 1;
      while (next[userGroup][key] || next[userGroup][`+:${key}`] || next[userGroup][`-:${key}`]) {
        key = `new_group_${i++}`;
      }
      next[userGroup] = { ...next[userGroup], [key]: key };
      return next;
    });
  };

  const deleteSpecialUsableEntry = (userGroup, rawKey) => {
    setGroupSpecialUsableGroup((prev) => {
      const next = { ...prev };
      if (next[userGroup]) {
        const inner = { ...next[userGroup] };
        delete inner[rawKey];
        if (Object.keys(inner).length === 0) {
          delete next[userGroup];
        } else {
          next[userGroup] = inner;
        }
      }
      return next;
    });
  };

  const updateSpecialUsableEntry = (
    oldUserGroup,
    oldRawKey,
    newUserGroup,
    newOpType,
    newTargetGroup,
    newDesc,
  ) => {
    setGroupSpecialUsableGroup((prev) => {
      const next = { ...prev };
      // Remove old
      if (next[oldUserGroup]) {
        const inner = { ...next[oldUserGroup] };
        delete inner[oldRawKey];
        if (Object.keys(inner).length === 0) {
          delete next[oldUserGroup];
        } else {
          next[oldUserGroup] = inner;
        }
      }
      // Build new key
      let newRawKey = newTargetGroup;
      if (newOpType === 'add') newRawKey = `+:${newTargetGroup}`;
      else if (newOpType === 'remove') newRawKey = `-:${newTargetGroup}`;
      // Add new
      if (!next[newUserGroup]) next[newUserGroup] = {};
      next[newUserGroup] = { ...next[newUserGroup], [newRawKey]: newDesc };
      return next;
    });
  };

  // --- Preview computation (mirrors service/group.go) ---
  const previewResult = useMemo(() => {
    if (!previewGroup) return [];

    // Step 1: Start from UserUsableGroups
    const usable = { ...userUsableGroups };

    // Step 2: Apply special usable group rules
    const specialRules = groupSpecialUsableGroup[previewGroup];
    if (specialRules) {
      for (const rawKey in specialRules) {
        const desc = specialRules[rawKey];
        if (rawKey.startsWith('-:')) {
          const groupToRemove = rawKey.substring(2);
          delete usable[groupToRemove];
        } else if (rawKey.startsWith('+:')) {
          const groupToAdd = rawKey.substring(2);
          usable[groupToAdd] = desc;
        } else {
          usable[rawKey] = desc;
        }
      }
    }

    // Step 3: Ensure user's own group is included
    if (!(previewGroup in usable)) {
      usable[previewGroup] = t('用户分组');
    }

    // Step 4: Build result with effective ratio
    const results = [];
    for (const gName in usable) {
      // Check groupGroupRatio first, then fall back to groupRatio
      let effectiveRatio;
      const ggr = groupGroupRatio[previewGroup];
      if (ggr && ggr[gName] !== undefined) {
        effectiveRatio = ggr[gName];
      } else {
        effectiveRatio = groupRatio[gName] !== undefined ? groupRatio[gName] : 1;
      }

      results.push({
        name: gName,
        description: usable[gName],
        ratio: effectiveRatio,
        modelCount: previewData[gName]?.model_count || 0,
        models: previewData[gName]?.models || [],
      });
    }

    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [
    previewGroup,
    userUsableGroups,
    groupSpecialUsableGroup,
    groupGroupRatio,
    groupRatio,
    previewData,
    t,
  ]);

  // --- Section A: Group Table Columns ---
  const groupColumns = [
    {
      title: t('分组名称'),
      dataIndex: 'name',
      width: 120,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: t('倍率'),
      dataIndex: 'ratio',
      width: 100,
      render: (_, record) => (
        <InputNumber
          size="small"
          min={0}
          step={0.1}
          value={record.ratio}
          onChange={(v) => updateGroupRatio(record.name, v)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: t('用户可选'),
      dataIndex: 'isUsable',
      width: 80,
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.isUsable}
          onChange={(v) => toggleUsable(record.name, v)}
        />
      ),
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      width: 150,
      render: (_, record) =>
        record.isUsable ? (
          <Input
            size="small"
            value={record.description}
            onChange={(v) => updateUsableDescription(record.name, v)}
            placeholder={record.name}
            style={{ width: '100%' }}
          />
        ) : (
          <Text type="tertiary">-</Text>
        ),
    },
    {
      title: t('自动分组'),
      dataIndex: 'isAutoGroup',
      width: 80,
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.isAutoGroup}
          onChange={(v) => toggleAutoGroup(record.name, v)}
        />
      ),
    },
    {
      title: t('模型数'),
      dataIndex: 'modelCount',
      width: 70,
      render: (count) => (
        <Tag size="small" color={count > 0 ? 'blue' : 'grey'}>
          {count}
        </Tag>
      ),
    },
    {
      title: t('操作'),
      width: 60,
      render: (_, record) => (
        <Button
          type="danger"
          theme="borderless"
          icon={<IconDelete />}
          size="small"
          onClick={() => deleteGroup(record.name)}
        />
      ),
    },
  ];

  // --- Section B: GroupGroupRatio Columns ---
  const ggrColumns = [
    {
      title: t('用户分组'),
      dataIndex: 'userGroup',
      width: 150,
      render: (_, record) => (
        <Select
          size="small"
          value={record.userGroup}
          onChange={(v) =>
            updateGroupGroupRatioEntry(
              record.userGroup,
              record.targetGroup,
              v,
              record.targetGroup,
              record.ratio,
            )
          }
          style={{ width: '100%' }}
        >
          {groupNames.map((g) => (
            <Select.Option key={g} value={g}>
              {g}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: t('目标分组'),
      dataIndex: 'targetGroup',
      width: 150,
      render: (_, record) => (
        <Select
          size="small"
          value={record.targetGroup}
          onChange={(v) =>
            updateGroupGroupRatioEntry(
              record.userGroup,
              record.targetGroup,
              record.userGroup,
              v,
              record.ratio,
            )
          }
          style={{ width: '100%' }}
        >
          {groupNames.map((g) => (
            <Select.Option key={g} value={g}>
              {g}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: t('特殊倍率'),
      dataIndex: 'ratio',
      width: 100,
      render: (_, record) => (
        <InputNumber
          size="small"
          min={0}
          step={0.1}
          value={record.ratio}
          onChange={(v) =>
            updateGroupGroupRatioEntry(
              record.userGroup,
              record.targetGroup,
              record.userGroup,
              record.targetGroup,
              v,
            )
          }
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: t('操作'),
      width: 60,
      render: (_, record) => (
        <Button
          type="danger"
          theme="borderless"
          icon={<IconDelete />}
          size="small"
          onClick={() =>
            deleteGroupGroupRatioEntry(record.userGroup, record.targetGroup)
          }
        />
      ),
    },
  ];

  // --- Section C: SpecialUsableGroup Columns ---
  const opTypeOptions = [
    { value: 'add', label: t('添加 (+:)') },
    { value: 'remove', label: t('移除 (-:)') },
    { value: 'direct', label: t('直接添加') },
  ];

  const getRawKey = (row) => {
    if (row.opType === 'add') return `+:${row.targetGroup}`;
    if (row.opType === 'remove') return `-:${row.targetGroup}`;
    return row.targetGroup;
  };

  const specialColumns = [
    {
      title: t('用户分组'),
      dataIndex: 'userGroup',
      width: 130,
      render: (_, record) => (
        <Select
          size="small"
          value={record.userGroup}
          onChange={(v) =>
            updateSpecialUsableEntry(
              record.userGroup,
              getRawKey(record),
              v,
              record.opType,
              record.targetGroup,
              record.description,
            )
          }
          style={{ width: '100%' }}
        >
          {groupNames.map((g) => (
            <Select.Option key={g} value={g}>
              {g}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: t('操作类型'),
      dataIndex: 'opType',
      width: 120,
      render: (_, record) => (
        <Select
          size="small"
          value={record.opType}
          onChange={(v) =>
            updateSpecialUsableEntry(
              record.userGroup,
              getRawKey(record),
              record.userGroup,
              v,
              record.targetGroup,
              record.description,
            )
          }
          style={{ width: '100%' }}
        >
          {opTypeOptions.map((o) => (
            <Select.Option key={o.value} value={o.value}>
              {o.label}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: t('目标分组'),
      dataIndex: 'targetGroup',
      width: 130,
      render: (_, record) => (
        <Input
          size="small"
          value={record.targetGroup}
          onChange={(v) =>
            updateSpecialUsableEntry(
              record.userGroup,
              getRawKey(record),
              record.userGroup,
              record.opType,
              v,
              record.description,
            )
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      width: 130,
      render: (_, record) => (
        <Input
          size="small"
          value={record.description}
          onChange={(v) =>
            updateSpecialUsableEntry(
              record.userGroup,
              getRawKey(record),
              record.userGroup,
              record.opType,
              record.targetGroup,
              v,
            )
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('操作'),
      width: 60,
      render: (_, record) => (
        <Button
          type="danger"
          theme="borderless"
          icon={<IconDelete />}
          size="small"
          onClick={() =>
            deleteSpecialUsableEntry(record.userGroup, getRawKey(record))
          }
        />
      ),
    },
  ];

  // --- Render preview card ---
  const renderPreviewCard = (item) => {
    const isExpanded = expandedModels[item.name];
    return (
      <Card
        key={item.name}
        style={{ marginBottom: 8 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Text strong>{item.name}</Text>
              <Tag size="small" color="blue">
                {item.ratio}x
              </Tag>
            </div>
            <Text type="secondary" size="small">
              {item.description}
            </Text>
            <div style={{ marginTop: 4 }}>
              <Text type="tertiary" size="small">
                {t('{{count}} 个可用模型', { count: item.modelCount })}
              </Text>
            </div>
          </div>
        </div>
        {item.models.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Button
              theme="borderless"
              size="small"
              icon={isExpanded ? <IconChevronDown /> : <IconChevronRight />}
              onClick={() =>
                setExpandedModels((prev) => ({
                  ...prev,
                  [item.name]: !prev[item.name],
                }))
              }
            >
              {isExpanded
                ? t('收起模型列表')
                : t('展开查看模型列表')}
            </Button>
            {isExpanded && (
              <div
                style={{
                  marginTop: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                }}
              >
                {item.models.map((m) => (
                  <Tag key={m} size="small">
                    {m}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={16} style={{ marginTop: 8 }}>
        {/* Left: Visual Editor */}
        <Col xs={24} md={14}>
          {/* Section A: Group List */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Title heading={6}>{t('分组列表')}</Title>
              <Button
                icon={<IconPlus />}
                size="small"
                onClick={() => setAddGroupVisible(true)}
              >
                {t('添加分组')}
              </Button>
            </div>
            <Table
              columns={groupColumns}
              dataSource={groupTableData}
              rowKey="name"
              pagination={false}
              size="small"
              empty={<Empty description={t('暂无分组')} />}
            />
          </div>

          {/* Section B: GroupGroupRatio */}
          <div style={{ marginBottom: 16 }}>
            <Button
              theme="borderless"
              onClick={() => setGroupGroupRatioOpen(!groupGroupRatioOpen)}
              icon={
                groupGroupRatioOpen ? (
                  <IconChevronDown />
                ) : (
                  <IconChevronRight />
                )
              }
            >
              {t('分组特殊倍率')} ({groupGroupRatioRows.length})
            </Button>
            <Collapsible
              isOpen={groupGroupRatioOpen}
              collapseHeight={0}
              keepDOM={true}
            >
              <div style={{ marginBottom: 8 }}>
                <Banner
                  type="info"
                  description={t(
                    '设置某个用户分组使用特定分组时的特殊倍率。例如 vip 用户使用 default 分组时倍率为 0.5',
                  )}
                  style={{ marginBottom: 8 }}
                />
                <Table
                  columns={ggrColumns}
                  dataSource={groupGroupRatioRows}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  empty={<Empty description={t('暂无特殊倍率规则')} />}
                />
                <Button
                  icon={<IconPlus />}
                  size="small"
                  theme="borderless"
                  onClick={addGroupGroupRatioRow}
                  style={{ marginTop: 4 }}
                >
                  {t('添加规则')}
                </Button>
              </div>
            </Collapsible>
          </div>

          {/* Section C: GroupSpecialUsableGroup */}
          <div style={{ marginBottom: 16 }}>
            <Button
              theme="borderless"
              onClick={() => setSpecialUsableOpen(!specialUsableOpen)}
              icon={
                specialUsableOpen ? (
                  <IconChevronDown />
                ) : (
                  <IconChevronRight />
                )
              }
            >
              {t('分组特殊可用分组')} ({specialUsableRows.length})
            </Button>
            <Collapsible
              isOpen={specialUsableOpen}
              collapseHeight={0}
              keepDOM={true}
            >
              <div style={{ marginBottom: 8 }}>
                <Banner
                  type="info"
                  description={t(
                    '设置某个用户分组可以使用的特殊分组。+: 添加分组，-: 移除分组，无前缀直接添加',
                  )}
                  style={{ marginBottom: 8 }}
                />
                <Table
                  columns={specialColumns}
                  dataSource={specialUsableRows}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  empty={<Empty description={t('暂无特殊可用分组规则')} />}
                />
                <Button
                  icon={<IconPlus />}
                  size="small"
                  theme="borderless"
                  onClick={addSpecialUsableRow}
                  style={{ marginTop: 4 }}
                >
                  {t('添加规则')}
                </Button>
              </div>
            </Collapsible>
          </div>

          {/* Section D: Auto Group Settings */}
          <div style={{ marginBottom: 16 }}>
            <Title heading={6} style={{ marginBottom: 8 }}>
              {t('自动分组设置')}
            </Title>
            <div style={{ marginBottom: 8 }}>
              <Text style={{ marginRight: 8 }}>{t('自动分组列表')}</Text>
              <Select
                multiple
                value={autoGroups}
                onChange={(v) => setAutoGroups(v)}
                style={{ width: '100%', maxWidth: 400 }}
                placeholder={t('选择自动分组')}
              >
                {groupNames.map((g) => (
                  <Select.Option key={g} value={g}>
                    {g}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={defaultUseAutoGroup}
                onChange={(v) => setDefaultUseAutoGroup(v)}
                size="small"
              />
              <Text>{t('创建令牌默认选择auto分组')}</Text>
            </div>
          </div>

          {/* Save Button */}
          <Button
            type="primary"
            icon={<IconSave />}
            onClick={handleSave}
            loading={loading}
          >
            {t('保存分组倍率设置')}
          </Button>
        </Col>

        {/* Right: Preview Panel */}
        <Col xs={24} md={10}>
          <Card
            title={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <IconEyeOpened />
                <span>{t('分组预览')}</span>
              </div>
            }
            style={{ position: 'sticky', top: 16 }}
          >
            <div style={{ marginBottom: 12 }}>
              <Text style={{ display: 'block', marginBottom: 4 }}>
                {t('预览用户分组')}
              </Text>
              <Select
                value={previewGroup}
                onChange={(v) => setPreviewGroup(v)}
                placeholder={t('选择要预览的用户分组')}
                style={{ width: '100%' }}
              >
                {groupNames.map((g) => (
                  <Select.Option key={g} value={g}>
                    {g}
                  </Select.Option>
                ))}
              </Select>
            </div>

            {previewGroup ? (
              <Spin spinning={previewLoading}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" size="small">
                    {t('当 {{group}} 分组的用户创建令牌时，可选择以下分组：', {
                      group: previewGroup,
                    })}
                  </Text>
                </div>
                {previewResult.length > 0 ? (
                  previewResult.map(renderPreviewCard)
                ) : (
                  <Empty description={t('无可用分组')} />
                )}
                <Banner
                  type="info"
                  description={t('模型数量基于已保存的设置，修改后请先保存再刷新预览')}
                  style={{ marginTop: 8 }}
                />
              </Spin>
            ) : (
              <Empty description={t('请选择一个用户分组进行预览')} />
            )}
          </Card>
        </Col>
      </Row>

      {/* Add Group Modal */}
      <Modal
        title={t('添加分组')}
        visible={addGroupVisible}
        onCancel={() => setAddGroupVisible(false)}
        footer={null}
      >
        <Form
          onSubmit={addGroup}
          labelPosition="left"
          labelWidth={80}
        >
          <Form.Input
            field="name"
            label={t('分组名称')}
            rules={[{ required: true, message: t('请输入分组名称') }]}
            placeholder={t('如：vip')}
          />
          <Form.InputNumber
            field="ratio"
            label={t('倍率')}
            initValue={1}
            min={0}
            step={0.1}
            rules={[{ required: true, message: t('请输入倍率') }]}
          />
          <Form.Switch
            field="isUsable"
            label={t('用户可选')}
            initValue={true}
          />
          <Form.Input
            field="description"
            label={t('描述')}
            placeholder={t('分组描述')}
          />
          <Button type="primary" htmlType="submit" style={{ marginTop: 8 }}>
            {t('确认添加')}
          </Button>
        </Form>
      </Modal>
    </Spin>
  );
}
