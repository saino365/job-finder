"use client";
import { useState } from 'react';
import { Layout, Row, Col, Typography } from "antd";
import RegisterWizard from "../../components/RegisterWizard";
import RegisterSidebar from "../../components/RegisterSidebar";
import RegistrationHeader from "../../components/RegistrationHeader";

const { Title, Text } = Typography;

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { key: 'account', title: 'Account' },
    { key: 'profile', title: 'Profile' },
    { key: 'education', title: 'Education' },
    { key: 'certs', title: 'Certifications' },
    { key: 'interests', title: 'Interests' },
    { key: 'work', title: 'Work' },
    { key: 'events', title: 'Events' },
  ];

  return (
    <>
      <RegistrationHeader />
      <Layout style={{ minHeight: '100vh' }}>
        <Row style={{ minHeight: '100vh' }}>
        {/* Left side - Independent progress and content */}
        <Col xs={0} md={12} lg={12} xl={12}>
          <div style={{
            backgroundColor: '#fff',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}>
            {/* Progress Steps - Positioned above title */}
            <div style={{
              display: 'flex',
              paddingLeft: 'clamp(100px, 30vw, 400px)',
              marginBottom: '40px',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              minHeight: '60px'
            }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transform: `translateX(${-currentStep * 52}px)`,
                  transition: 'transform 0.3s ease'
                }}
              >
                {steps.map((step, index) => (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: index === currentStep ? '50px' : '40px',
                        height: index === currentStep ? '50px' : '40px',
                        borderRadius: '50%',
                        backgroundColor: index <= currentStep ? '#7d69ff' : '#f0f0f0',
                        color: index <= currentStep ? '#fff' : '#999',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: index === currentStep ? '16px' : '14px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease',
                        border: index === currentStep ? '3px solid #7d69ff' : '3px solid transparent',
                        boxShadow: index === currentStep ? '0 0 0 3px rgba(125, 105, 255, 0.2)' : 'none',
                        transform: index === currentStep ? 'scale(1.1)' : 'scale(1)',
                        zIndex: index === currentStep ? 10 : 1
                      }}
                    >
                      {index + 1}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        style={{
                          width: '30px',
                          height: '3px',
                          backgroundColor: index < currentStep ? '#7d69ff' : '#f0f0f0',
                          marginLeft: '8px',
                          marginRight: '8px',
                          transition: 'all 0.3s ease',
                          borderRadius: '2px'
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Step Information - Centered below progress */}
            <div style={{ textAlign: 'center', maxWidth: '400px', padding: '0 20px' }}>
              <Title level={3} style={{ marginBottom: '12px', color: '#7d69ff' }}>
                {currentStep === 0 && "Account Setup"}
                {currentStep === 1 && "Personal Information"}
                {currentStep === 2 && "Education Background"}
                {currentStep === 3 && "Professional Certifications"}
                {currentStep === 4 && "Interests & Hobbies"}
                {currentStep === 5 && "Work Experience"}
                {currentStep === 6 && "Event Participation"}
              </Title>
              <Text type="secondary" style={{ fontSize: '16px', lineHeight: '1.5' }}>
                {currentStep === 0 && "Create your login credentials and verify your email address to get started."}
                {currentStep === 1 && "Tell us about yourself with your basic personal details and contact information."}
                {currentStep === 2 && "Add your educational background to help employers understand your qualifications."}
                {currentStep === 3 && "Showcase your professional certifications and credentials to stand out."}
                {currentStep === 4 && "Share your interests and hobbies to help employers get to know you better."}
                {currentStep === 5 && "Add your work experience to highlight your professional skills and achievements."}
                {currentStep === 6 && "Add events you've participated in to show your community involvement and leadership."}
              </Text>
            </div>
          </div>
        </Col>

        {/* Right side - Register Form */}
        <Col xs={24} md={12} lg={12} xl={12}>
          <div
            style={{
              minHeight: '100vh',
              overflowY: 'auto',
              padding: '24px',
              '@media (max-width: 768px) and (orientation: landscape)': {
                padding: '8px',
                minHeight: 'auto',
                maxHeight: '100vh'
              }
            }}
            className="register-form-container"
          >
            <div
              style={{
                minHeight: 'calc(100vh - 48px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '20px',
                paddingBottom: '20px'
              }}
            >
              <div style={{ width: '100%', maxWidth: '500px' }}>
                <RegisterWizard onStepChange={setCurrentStep} />
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Layout>
    </>
  );
}

