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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Typography, Tooltip } from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { IconGithubLogo } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import { Terminal, Copy, Check, Code2, ChevronRight } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import {
  OpenAI,
  Zhipu,
  Claude,
  Gemini,
} from '@lobehub/icons';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('javascript', javascript);

const { Text } = Typography;

const CODE_TABS = [
  { key: 'curl', label: 'curl', lang: 'bash' },
  { key: 'python', label: 'Python', lang: 'python' },
  { key: 'nodejs', label: 'Node.js', lang: 'javascript' },
];

const getCodeExamples = (baseUrl) => ({
  curl: `curl ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`,
  python: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="sk-your-api-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)`,
  nodejs: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "sk-your-api-key",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "user", content: "Hello!" },
  ],
});

console.log(response.choices[0].message.content);`,
});

const providerIcons = [
  <OpenAI key='openai' size={40} />,
  <Zhipu.Color key='zhipu' size={40} />,
  <Claude.Color key='claude' size={40} />,
  <Gemini.Color key='gemini' size={40} />,
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const [endpointIndex, setEndpointIndex] = useState(0);
  const isChinese = i18n.language.startsWith('zh');

  const [activeCodeTab, setActiveCodeTab] = useState('curl');
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const codeExamples = useMemo(
    () => getCodeExamples(serverAddress),
    [serverAddress],
  );

  const highlightedCode = useMemo(() => {
    const tab = CODE_TABS.find((t) => t.key === activeCodeTab);
    if (!tab) return '';
    try {
      return hljs.highlight(codeExamples[activeCodeTab], {
        language: tab.lang,
      }).value;
    } catch {
      return codeExamples[activeCodeTab];
    }
  }, [activeCodeTab, codeExamples]);

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      setUrlCopied(true);
      showSuccess(t('已复制到剪切板'));
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    const ok = await copy(codeExamples[activeCodeTab]);
    if (ok) {
      setCodeCopied(true);
      showSuccess(t('已复制到剪切板'));
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % API_ENDPOINTS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          {/* Banner */}
          <div className='w-full border-b border-semi-color-border min-h-[500px] md:min-h-[600px] lg:min-h-[700px] relative overflow-x-hidden'>
            {/* Background blur balls */}
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />

            {/* Decorative code braces */}
            <div className='home-deco-brace text-[180px] md:text-[280px] opacity-[0.03] top-[5%] left-[5%] text-semi-color-text-0'>
              {'{'}
            </div>
            <div className='home-deco-brace text-[180px] md:text-[280px] opacity-[0.03] bottom-[5%] right-[5%] text-semi-color-text-0'>
              {'}'}
            </div>

            <div className='flex items-center justify-center h-full px-4 py-16 md:py-20 lg:py-28 mt-10'>
              <div className='flex flex-col items-center justify-center text-center max-w-4xl mx-auto'>
                {/* Headline */}
                <div className='flex flex-col items-center justify-center mb-6 md:mb-8'>
                  <h1
                    className={`text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-semi-color-text-0 leading-tight ${isChinese ? 'tracking-wide md:tracking-wider' : ''}`}
                  >
                    {t('一个接口')}
                    <br />
                    <span className='shine-text'>
                      {t('主流大模型')}
                    </span>
                  </h1>
                  <p className='text-base md:text-lg lg:text-xl text-semi-color-text-1 mt-4 md:mt-6 max-w-xl'>
                    {t(
                      '只需替换 BASE URL，即可通过统一接口访问所有主流大模型',
                    )}
                  </p>
                </div>

                {/* Base URL Display */}
                <div className='home-base-url mb-2'>
                  <span className='home-base-url-label'>BASE URL</span>
                  <span className='home-base-url-value'>{serverAddress}</span>
                  <Tooltip
                    content={urlCopied ? t('已复制') : t('复制')}
                    position='top'
                  >
                    <button
                      className='home-copy-btn'
                      onClick={handleCopyBaseURL}
                    >
                      {urlCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </Tooltip>
                </div>

                {/* Endpoint ticker */}
                <div className='home-endpoints mb-6'>
                  <ChevronRight size={14} />
                  <span className='text-semi-color-text-2'>
                    {t('可用端点')}:
                  </span>
                  <span className='home-endpoint-item' key={endpointIndex}>
                    {API_ENDPOINTS[endpointIndex]}
                  </span>
                </div>

                {/* Code Snippet Block */}
                <div className='home-code-block mb-8'>
                  <div className='home-code-header'>
                    <div className='home-code-tabs'>
                      {CODE_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          className={`home-code-tab ${activeCodeTab === tab.key ? 'home-code-tab-active' : ''}`}
                          onClick={() => setActiveCodeTab(tab.key)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <button
                      className='home-copy-btn'
                      onClick={handleCopyCode}
                    >
                      {codeCopied ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>
                        {codeCopied ? t('已复制') : t('复制代码')}
                      </span>
                    </button>
                  </div>
                  <div className='home-code-body'>
                    <pre
                      style={{ margin: 0, whiteSpace: 'pre', tabSize: 2 }}
                    >
                      <code
                        className='hljs'
                        dangerouslySetInnerHTML={{
                          __html: highlightedCode,
                        }}
                      />
                    </pre>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className='flex flex-row gap-4 justify-center items-center mb-10'>
                  <Link to='/console'>
                    <Button
                      theme='solid'
                      type='primary'
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-xl px-8 py-2'
                      icon={<Terminal size={16} />}
                    >
                      {t('获取密钥')}
                    </Button>
                  </Link>
                  {isDemoSiteMode && statusState?.status?.version ? (
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='flex items-center !rounded-xl px-6 py-2'
                      icon={<IconGithubLogo />}
                      onClick={() =>
                        window.open(
                          'https://github.com/QuantumNous/new-api',
                          '_blank',
                        )
                      }
                    >
                      {statusState.status.version}
                    </Button>
                  ) : (
                    docsLink && (
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='flex items-center !rounded-xl px-6 py-2'
                        icon={<Code2 size={16} />}
                        onClick={() => window.open(docsLink, '_blank')}
                      >
                        {t('文档')}
                      </Button>
                    )
                  )}
                </div>

                {/* Provider Grid */}
                <div className='w-full'>
                  <div className='flex items-center mb-6 md:mb-8 justify-center'>
                    <Text
                      type='tertiary'
                      className='text-lg md:text-xl lg:text-2xl font-light'
                    >
                      {t('支持众多的大模型供应商')}
                    </Text>
                  </div>
                  {!isMobile ? (
                    <div className='overflow-hidden w-full max-w-5xl mx-auto'>
                      <div className='home-provider-marquee'>
                        {[...providerIcons, ...providerIcons].map(
                          (icon, i) => (
                            <div
                              key={i}
                              className='w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mx-3 md:mx-4 flex-shrink-0'
                            >
                              {icon}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className='flex flex-wrap items-center justify-center gap-3 max-w-5xl mx-auto px-4'>
                      {providerIcons.map((icon, i) => (
                        <div
                          key={i}
                          className='w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center'
                        >
                          {icon}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
