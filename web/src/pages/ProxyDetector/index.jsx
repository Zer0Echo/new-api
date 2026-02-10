import React, { useState, useRef, useContext, useMemo } from 'react';
import {
  Card,
  Form,
  Button,
  Select,
  InputNumber,
  Tag,
  Table,
  Collapse,
  Typography,
  Banner,
  Spin,
  Space,
  Input,
  Toast,
  Checkbox,
} from '@douyinfe/semi-ui';
import { Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { API, isAdmin, showError } from '../../helpers';

const { Title, Text, Paragraph } = Typography;

const VERDICT_CONFIG = {
  anthropic: { color: 'green', label: 'Anthropic 官方 API' },
  bedrock: { color: 'blue', label: 'AWS Bedrock (Kiro)' },
  antigravity: { color: 'purple', label: 'Google Vertex AI (Antigravity)' },
  suspicious: { color: 'orange', label: '疑似伪装 Anthropic' },
  unknown: { color: 'grey', label: '无法确定' },
  unavailable: { color: 'white', label: '不可用' },
};

const ProxyDetector = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const admin = isAdmin();

  const serverAddress = useMemo(() => {
    return statusState?.status?.server_address || window.location.origin;
  }, [statusState]);

  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedModels, setSelectedModels] = useState([]);
  const [rounds, setRounds] = useState(2);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [claudeModels, setClaudeModels] = useState([]);
  const [verifyRatelimit, setVerifyRatelimit] = useState(false);
  const summaryRef = useRef(null);

  const effectiveBaseURL = admin ? (baseURL || serverAddress) : serverAddress;

  const handleFetchModels = async () => {
    if (!apiKey) {
      showError(t('请输入 API Key'));
      return;
    }
    setModelsLoading(true);
    try {
      const res = await API.post('/api/proxy-detect/models', {
        base_url: effectiveBaseURL,
        api_key: apiKey,
      });
      if (res.data.success) {
        const models = res.data.data || [];
        setClaudeModels(models);
        if (models.length > 0) {
          Toast.success(t('获取到 {{count}} 个 Claude 模型').replace('{{count}}', models.length));
        } else {
          Toast.warning(t('未找到 Claude 模型，请手动输入模型名称'));
        }
      } else {
        showError(res.data.message);
      }
    } catch (err) {
      showError(err.message || t('获取模型列表失败'));
    } finally {
      setModelsLoading(false);
    }
  };

  const handleDetect = async () => {
    if (!apiKey) {
      showError(t('请输入 API Key'));
      return;
    }
    if (selectedModels.length === 0) {
      showError(t('请选择要检测的模型'));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await API.post('/api/proxy-detect/detect', {
        base_url: effectiveBaseURL,
        api_key: apiKey,
        models: selectedModels.slice(0, 6),
        rounds: rounds,
        verify_ratelimit: selectedModels.length === 1 ? verifyRatelimit : false,
      });
      if (res.data.success) {
        setResult(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (err) {
      showError(err.message || t('检测请求失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshot = async () => {
    if (!summaryRef.current) return;
    try {
      const dataUrl = await toPng(summaryRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      Toast.success(t('已复制截图到剪贴板'));
    } catch {
      try {
        const dataUrl = await toPng(summaryRef.current, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
        });
        const link = document.createElement('a');
        link.download = `proxy-detect-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        Toast.info(t('已下载截图'));
      } catch {
        Toast.error(t('截图失败'));
      }
    }
  };

  const renderVerdictTag = (verdict) => {
    const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.unknown;
    return (
      <Tag color={config.color} size='large' style={{ fontSize: 14 }}>
        {config.label}
      </Tag>
    );
  };

  const renderConfidence = (confidence) => {
    const pct = Math.round(confidence * 100);
    let color = 'var(--semi-color-success)';
    if (pct < 60) color = 'var(--semi-color-warning)';
    if (pct < 30) color = 'var(--semi-color-danger)';
    return (
      <span style={{ color, fontWeight: 600, fontSize: 16 }}>{pct}%</span>
    );
  };

  const renderScores = (scores) => {
    if (!scores) return null;
    return (
      <Space>
        <Tag color='green' size='small'>
          Anthropic: {scores.anthropic || 0}
        </Tag>
        <Tag color='blue' size='small'>
          Bedrock: {scores.bedrock || 0}
        </Tag>
        <Tag color='purple' size='small'>
          Antigravity: {scores.antigravity || 0}
        </Tag>
      </Space>
    );
  };

  const fingerprintColumns = [
    {
      title: '#',
      dataIndex: 'index',
      width: 50,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: t('探测类型'),
      dataIndex: 'probe_type',
      width: 90,
    },
    {
      title: 'tool_id',
      dataIndex: 'tool_id_source',
      width: 110,
      render: (text) => {
        const colorMap = {
          anthropic: 'green',
          bedrock: 'blue',
          vertex: 'purple',
          rewritten: 'orange',
        };
        return <Tag color={colorMap[text] || 'grey'} size='small'>{text || '-'}</Tag>;
      },
    },
    {
      title: 'msg_id',
      dataIndex: 'msg_id_source',
      width: 110,
      render: (text) => {
        const colorMap = {
          anthropic: 'green',
          antigravity: 'orange',
          vertex: 'purple',
          rewritten: 'grey',
        };
        return <Tag color={colorMap[text] || 'grey'} size='small'>{text || '-'}</Tag>;
      },
    },
    {
      title: 'service_tier',
      dataIndex: 'service_tier',
      width: 120,
      render: (text, record) =>
        record.has_service_tier ? (
          <Tag color='green' size='small'>{text}</Tag>
        ) : (
          <Text type='tertiary'>-</Text>
        ),
    },
    {
      title: 'thinking',
      dataIndex: 'thinking_sig_class',
      width: 100,
      render: (text) => {
        if (!text || text === 'none') return <Text type='tertiary'>-</Text>;
        const colorMap = { normal: 'green', short: 'orange', vertex: 'purple' };
        return <Tag color={colorMap[text] || 'grey'} size='small'>{text}</Tag>;
      },
    },
    {
      title: t('延迟'),
      dataIndex: 'latency_ms',
      width: 80,
      render: (text) => (text ? `${text}ms` : '-'),
    },
  ];

  const renderSingleResult = (res, showScreenshot = false) => {
    if (!res) return null;
    return (
      <div className='space-y-4'>
        {/* Summary Card */}
        <div ref={showScreenshot ? summaryRef : undefined}>
          <Card
            style={{
              borderLeft: `4px solid var(--semi-color-${
                res.verdict === 'suspicious'
                  ? 'warning'
                  : res.verdict === 'unknown'
                    ? 'text-3'
                    : 'success'
              })`,
            }}
            headerExtraContent={
              showScreenshot ? (
                <Button
                  icon={<Camera size={14} />}
                  size='small'
                  theme='borderless'
                  onClick={handleScreenshot}
                >
                  {t('复制截图')}
                </Button>
              ) : undefined
            }
          >
          <div className='space-y-3'>
            <div className='flex items-center gap-3 flex-wrap'>
              <Text strong style={{ fontSize: 14 }}>
                {t('判定')}:
              </Text>
              {renderVerdictTag(res.verdict)}
              <Text type='tertiary' style={{ marginLeft: 8 }}>
                {t('置信度')}: {renderConfidence(res.confidence)}
              </Text>
            </div>
            <div className='flex items-center gap-3 flex-wrap'>
              <Text strong style={{ fontSize: 14 }}>
                {t('评分')}:
              </Text>
              {renderScores(res.scores)}
            </div>
            <div className='flex items-center gap-4 flex-wrap'>
              {res.model && (
                <Text type='secondary'>
                  {t('模型')}: {res.model}
                </Text>
              )}
              {res.avg_latency_ms > 0 && (
                <Text type='secondary'>
                  {t('平均延迟')}: {res.avg_latency_ms}ms
                </Text>
              )}
              {res.proxy_platform && (
                <Text type='secondary'>
                  {t('中转平台')}: {res.proxy_platform}
                </Text>
              )}
            </div>
            {res.platform_clues && res.platform_clues.length > 0 && (
              <div className='flex items-center gap-2 flex-wrap'>
                <Text type='tertiary' style={{ fontSize: 12 }}>
                  {t('平台线索')}:
                </Text>
                {res.platform_clues.map((clue, idx) => (
                  <Tag key={idx} color='grey' size='small' style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {clue}
                  </Tag>
                ))}
              </div>
            )}
            {res.ratelimit_verify && (
              <div className='flex items-center gap-3 flex-wrap'>
                <Text strong style={{ fontSize: 14 }}>
                  Ratelimit:
                </Text>
                <Tag
                  color={
                    res.ratelimit_verify.verdict === 'dynamic' ? 'green'
                      : res.ratelimit_verify.verdict === 'static' ? 'red'
                        : 'grey'
                  }
                  size='small'
                >
                  {res.ratelimit_verify.verdict}
                </Tag>
                <Text type='tertiary' style={{ fontSize: 12 }}>
                  {res.ratelimit_verify.detail}
                </Text>
              </div>
            )}
          </div>
          </Card>
        </div>

        {/* Evidence Chain */}
        {res.evidence && res.evidence.length > 0 && (
          <Collapse>
            <Collapse.Panel
              header={t('证据链') + ` (${res.evidence.length})`}
              itemKey='evidence'
            >
              <div className='space-y-1'>
                {res.evidence.map((e, idx) => {
                  let textType = 'secondary';
                  if (e.startsWith('[!!]') || e.startsWith('[缺失]')) textType = 'warning';
                  if (e.startsWith('[修正]')) textType = 'tertiary';
                  return (
                    <Paragraph
                      key={idx}
                      type={textType}
                      style={{ margin: 0, fontSize: 13, fontFamily: 'monospace' }}
                    >
                      {e}
                    </Paragraph>
                  );
                })}
              </div>
            </Collapse.Panel>
          </Collapse>
        )}

        {/* Fingerprint Table */}
        {res.fingerprints && res.fingerprints.length > 0 && (
          <Collapse>
            <Collapse.Panel
              header={t('指纹摘要') + ` (${res.fingerprints.length})`}
              itemKey='fingerprints'
            >
              <Table
                columns={fingerprintColumns}
                dataSource={res.fingerprints.filter((fp) => !fp.error)}
                pagination={false}
                size='small'
                rowKey={(_, idx) => idx}
              />
              {res.fingerprints.some((fp) => fp.error) && (
                <div className='mt-2'>
                  {res.fingerprints
                    .filter((fp) => fp.error)
                    .map((fp, idx) => (
                      <Text key={idx} type='danger' size='small'>
                        {t('探测失败')}: {fp.error}
                      </Text>
                    ))}
                </div>
              )}
            </Collapse.Panel>
          </Collapse>
        )}
      </div>
    );
  };

  const renderScanResult = (scan) => {
    if (!scan) return null;

    const summaryColumns = [
      {
        title: t('模型'),
        dataIndex: 'model',
        render: (text) => <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{text}</Text>,
      },
      {
        title: t('判定'),
        dataIndex: 'verdict',
        width: 220,
        render: (text) => renderVerdictTag(text),
      },
      {
        title: t('置信度'),
        dataIndex: 'confidence',
        width: 100,
        render: (val, record) =>
          record.verdict === 'unavailable' ? (
            <Text type='tertiary'>-</Text>
          ) : (
            renderConfidence(val)
          ),
      },
      {
        title: t('延迟'),
        dataIndex: 'avg_latency_ms',
        width: 100,
        render: (val, record) =>
          record.verdict === 'unavailable' ? (
            <Text type='tertiary'>-</Text>
          ) : (
            `${val}ms`
          ),
      },
    ];

    return (
      <div className='space-y-4'>
        {scan.is_mixed && (
          <Banner
            type='warning'
            description={t('检测到混合渠道：不同模型路由到不同后端')}
          />
        )}

        {/* Summary Table */}
        <div ref={summaryRef}>
          <Card
            title={t('扫描总览')}
            headerExtraContent={
              <Button
                icon={<Camera size={14} />}
                size='small'
                theme='borderless'
                onClick={handleScreenshot}
              >
                {t('复制截图')}
              </Button>
            }
          >
            <Table
              columns={summaryColumns}
              dataSource={scan.model_results}
              pagination={false}
              size='small'
              rowKey={(record) => record.model}
            />
          </Card>
        </div>

        {/* Per-model Details */}
        <Collapse>
          {scan.model_results
            .filter((r) => r.verdict !== 'unavailable')
            .map((r) => (
              <Collapse.Panel
                key={r.model}
                header={
                  <div className='flex items-center gap-2'>
                    <Text style={{ fontFamily: 'monospace' }}>{r.model}</Text>
                    {renderVerdictTag(r.verdict)}
                  </div>
                }
                itemKey={r.model}
              >
                {renderSingleResult(r)}
              </Collapse.Panel>
            ))}
        </Collapse>
      </div>
    );
  };

  const referenceData = [
    {
      key: 'tool_use_id',
      dimension: 'tool_use id',
      anthropic: 'toolu_',
      bedrock: 'tooluse_',
      antigravity: 'tooluse_ / tool_N',
    },
    {
      key: 'message_id',
      dimension: 'message id',
      anthropic: 'msg_<base62>',
      bedrock: 'UUID / msg_<UUID>',
      antigravity: 'msg_<UUID> / req_vrtx_',
    },
    {
      key: 'thinking_sig',
      dimension: 'thinking sig',
      anthropic: 'len 200+',
      bedrock: 'len 200+ / 截断',
      antigravity: 'claude# 前缀 / 截断',
    },
    {
      key: 'model',
      dimension: 'model',
      anthropic: 'claude-*',
      bedrock: 'kiro-* / anthropic.*',
      antigravity: 'claude-*',
    },
    {
      key: 'service_tier',
      dimension: 'service_tier',
      anthropic: '有',
      bedrock: '无',
      antigravity: '无',
    },
    {
      key: 'inference_geo',
      dimension: 'inference_geo',
      anthropic: '有',
      bedrock: '无',
      antigravity: '无',
    },
    {
      key: 'ratelimit',
      dimension: 'rate-limit hdr',
      anthropic: '有',
      bedrock: '无',
      antigravity: '无',
    },
  ];

  const referenceColumns = [
    { title: t('指纹维度'), dataIndex: 'dimension', width: 140 },
    {
      title: 'Anthropic',
      dataIndex: 'anthropic',
      render: (text) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</Text>
      ),
    },
    {
      title: 'Bedrock (Kiro)',
      dataIndex: 'bedrock',
      render: (text) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</Text>
      ),
    },
    {
      title: 'Antigravity',
      dataIndex: 'antigravity',
      render: (text) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</Text>
      ),
    },
  ];

  // Determine result rendering mode
  const isSingleResult = result && result.model_results && result.model_results.length === 1;
  const isMultiResult = result && result.model_results && result.model_results.length > 1;

  return (
    <div className='mt-[60px] px-4 pb-8'>
      <div className='max-w-[960px] mx-auto space-y-6'>
        {/* Header */}
        <div>
          <Title heading={3}>{t('CC 代理检测')}</Title>
          <Text type='secondary'>
            {t('检测中转站真实后端来源：Anthropic 官方 / AWS Bedrock / Google Vertex AI')}
          </Text>
        </div>

        {/* Form */}
        <Card>
          <Form layout='vertical'>
            {/* Base URL */}
            <Form.Slot label={t('目标地址')}>
              {admin ? (
                <Input
                  value={baseURL}
                  onChange={setBaseURL}
                  placeholder={serverAddress}
                  style={{ width: '100%' }}
                />
              ) : (
                <Input
                  value={serverAddress}
                  disabled
                  style={{ width: '100%' }}
                />
              )}
            </Form.Slot>

            {/* API Key */}
            <Form.Slot label='API Key'>
              <Input
                mode='password'
                value={apiKey}
                onChange={setApiKey}
                placeholder={t('请输入 API Key')}
                style={{ width: '100%' }}
              />
            </Form.Slot>

            {/* Models */}
            <Form.Slot label={t('选择检测模型')}>
              <div className='flex gap-2 items-start w-full'>
                <Select
                  key={claudeModels.join(',')}
                  multiple
                  value={selectedModels}
                  onChange={(val) => setSelectedModels((val || []).slice(0, 6))}
                  style={{ flex: 1 }}
                  optionList={claudeModels.map((m) => ({
                    value: m,
                    label: m,
                  }))}
                  placeholder={t('请先获取模型列表或手动输入模型名称')}
                  filter
                  allowCreate
                  maxTagCount={3}
                />
                <Button
                  onClick={handleFetchModels}
                  loading={modelsLoading}
                  style={{ flexShrink: 0 }}
                >
                  {modelsLoading ? t('获取中...') : t('获取模型列表')}
                </Button>
              </div>
              <Text type='tertiary' style={{ fontSize: 12, marginTop: 4 }}>
                {t('最多选择 6 个模型')}
                {selectedModels.length > 0 && ` (${t('已选择')} ${selectedModels.length})`}
              </Text>
            </Form.Slot>

            {/* Rounds */}
            <Form.Slot label={t('探测轮次')}>
              <InputNumber
                value={rounds}
                onChange={setRounds}
                min={1}
                max={3}
                style={{ width: 120 }}
              />
              <Text type='tertiary' style={{ marginLeft: 8, fontSize: 12 }}>
                {t('每个模型的 tool 探测轮次（额外 1 轮 thinking 探测）')}
              </Text>
            </Form.Slot>

            {/* Verify Ratelimit (single model only) */}
            {selectedModels.length === 1 && (
              <Form.Slot label={t('高级选项')}>
                <Checkbox
                  checked={verifyRatelimit}
                  onChange={(e) => setVerifyRatelimit(e.target.checked)}
                >
                  {t('验证 Ratelimit 真伪')}
                </Checkbox>
                <Text type='tertiary' style={{ marginLeft: 8, fontSize: 12 }}>
                  {t('额外发送 4 次请求检测 ratelimit header 是否真实递减')}
                </Text>
              </Form.Slot>
            )}

            {/* Submit */}
            <Form.Slot>
              <Button
                theme='solid'
                type='primary'
                loading={loading}
                onClick={handleDetect}
                disabled={selectedModels.length === 0}
                style={{ width: 160 }}
              >
                {loading ? t('检测中...') : t('开始检测')}
              </Button>
            </Form.Slot>
          </Form>
        </Card>

        {/* Loading */}
        {loading && (
          <div className='flex justify-center py-8'>
            <Spin size='large' tip={t('正在探测中，请稍候...')} />
          </div>
        )}

        {/* Results */}
        {!loading && isSingleResult && (
          <div className='space-y-4'>
            <Title heading={5}>{t('检测结果')}</Title>
            {renderSingleResult(result.model_results[0], true)}
          </div>
        )}

        {!loading && isMultiResult && (
          <div className='space-y-4'>
            <Title heading={5}>{t('检测结果')}</Title>
            {renderScanResult(result)}
          </div>
        )}

        {/* Reference Table */}
        <Collapse>
          <Collapse.Panel
            header={t('三源指纹参考表')}
            itemKey='reference'
          >
            <Table
              columns={referenceColumns}
              dataSource={referenceData}
              pagination={false}
              size='small'
              rowKey='key'
            />
          </Collapse.Panel>
        </Collapse>

        {/* Credits */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <Text type='tertiary' style={{ fontSize: 12 }}>
            {t('检测逻辑基于')}{' '}
            <a
              href='https://github.com/zxc123aa/cc-proxy-detector'
              target='_blank'
              rel='noopener noreferrer'
              style={{ color: 'var(--semi-color-link)' }}
            >
              cc-proxy-detector
            </a>
            {' '}{t('开源项目，感谢原作者的贡献。')}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ProxyDetector;
