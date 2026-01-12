"use client";
import { useState } from 'react';
import { Typography, Input, Button, Space, Select, theme as antdTheme, Col, Row } from 'antd';

import { useTheme } from './Providers';

export default function Hero({ onSearch, industryOptions = [] }) {
  const { theme } = useTheme();
  const { token } = antdTheme.useToken();
  const [q, setQ] = useState("");
  const bg = theme === 'dark' ? 'linear-gradient(180deg,#0b1220 0%, #0d1325 100%)' : 'linear-gradient(135deg,#f0f5ff,#fff)';

  function handleSubmit() {
    console.log('🔍 Hero: Search submitted with query:', q);
    if (typeof onSearch === 'function') {
      console.log('🔍 Hero: Calling onSearch callback');
      onSearch({ q });
    } else {
      console.log('⚠️ Hero: onSearch is not a function');
    }
  }

  return (
    <div style={{
      padding: '40px 16px 60px',
      background: bg,
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 32]} align="middle" style={{ minHeight: '400px' }}>
          {/* Left Content */}
          <Col xs={24} md={12} lg={12} xl={12}>
            <div style={{
              textAlign: { xs: 'center', md: 'left' },
              padding: '0 20px'
            }}>
              <Typography.Title
                level={1}
                style={{
                  marginBottom: '16px',
                  fontWeight: 700,
                  fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                  lineHeight: '1.2'
                }}
              >
                Search for jobs, companies, or keywords
              </Typography.Title>
              <Typography.Text
                style={{
                  fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                  fontWeight: 400,
                  color: '#666',
                  display: 'block',
                  marginBottom: '32px',
                  lineHeight: '1.5'
                }}
              >
                Browse active jobs and approved companies
              </Typography.Text>

              <div style={{ maxWidth: '650px', margin: '0 auto' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="Search skills, company or job title"
                    value={q}
                    onChange={(e)=>setQ(e.target.value)}
                    onPressEnter={handleSubmit}
                    style={{
                      borderRadius: '25px',
                      padding: '12px 20px',
                      fontSize: '16px',
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
                      border: '2px solid #f0f0f0'
                    }}
                    size="large"
                  />
                  <Button
                    type="primary"
                    onClick={handleSubmit}
                    style={{
                      borderRadius: '25px',
                      background: 'linear-gradient(to right, #7d69ff, #917fff)',
                      marginLeft: '8px',
                      padding: '12px 24px',
                      height: 'auto',
                      fontSize: '16px',
                      fontWeight: '600',
                      boxShadow: "0 4px 20px rgba(125, 105, 255, 0.3)",
                      border: 'none'
                    }}
                    size="large"
                  >
                    Search
                  </Button>
                </Space.Compact>
              </div>
            </div>
          </Col>

          {/* Right Image */}
          <Col xs={24} md={12} lg={12} xl={12}>
            <div
              style={{
                height: 'clamp(300px, 40vh, 450px)',
                width: '100%',
                backgroundImage: 'url(/images/company-registration.png)',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                margin: '0 auto'
              }}
            />
          </Col>
        </Row>
      </div>
    </div>
  );
}

