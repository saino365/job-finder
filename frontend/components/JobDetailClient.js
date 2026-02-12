"use client";
import Navbar from "./Navbar";
import Footer from "./Footer";
import JobDetailActions from "./JobDetailActions";
import SimilarJobs from "./SimilarJobs";
import { useEffect, useState } from 'react';
import { apiAuth, getToken } from '../lib/api';
import {
  Layout,
  Typography,
  Tag,
  Card,
  Row,
  Col,
  Space,
  Alert
} from "antd";
import {
  CalendarOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BankOutlined
} from "@ant-design/icons";
import Link from "next/link";
import { formatDate, formatSalary } from "../utils/formatters";

const { Title, Text, Paragraph } = Typography;

export default function JobDetailClient({ job }) {
  const [hiredCount, setHiredCount] = useState(job.hiredCount || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If hiredCount wasn't provided in job prop, fetch it
    if (job.hiredCount === undefined) {
      (async () => {
        try {
          setLoading(true);
          const empRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3030'}/employment-records?jobListingId=${job._id}&status=1&$limit=0`);
          if (empRes.ok) {
            const empData = await empRes.json();
            const count = empData.total || empData.length || 0;
            setHiredCount(count);
          }
        } catch (_) { /* ignore */ }
        finally {
          setLoading(false);
        }
      })();
    }
  }, [job._id, job.hiredCount]);

  if (!job) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
          <Card>
            <Title level={3}>Job unavailable</Title>
            <Text type="secondary">This job listing may have been removed or is no longer available.</Text>
          </Card>
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  const isPositionFull = job.quantityAvailable && hiredCount >= job.quantityAvailable;





  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* Position Full Alert */}
        {isPositionFull && (
          <Alert
            message="Position Closed"
            description={`This position is now closed. All ${job.quantityAvailable} available slot${job.quantityAvailable > 1 ? 's have' : ' has'} been filled with hired candidates.`}
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}
        
        {/* Header Section with Similar Jobs */}
        <Row gutter={[24, 24]}>
          {/* Left: Job Header */}
          <Col xs={24} lg={16}>
            <Card style={{ border: '0.5px solid lightgray', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', marginBottom: 16 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={16}>
                  <div>
                    <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
                      {job.title}
                    </Title>

                    {job.company && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <BankOutlined style={{ color: '#666' }} />
                        {job.company._id ? (
                          <Link href={`/companies/${job.company._id}`}>
                            <Text strong style={{ fontSize: 16 }}>{job.company.name}</Text>
                          </Link>
                        ) : (
                          <Text strong style={{ fontSize: 16 }}>{job.company.name}</Text>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {job.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <EnvironmentOutlined style={{ color: '#666' }} />
                          <Text>{job.location.city}{job.location.state && `, ${job.location.state}`}</Text>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <DollarOutlined style={{ color: '#666' }} />
                        <Text>{formatSalary(job.salaryRange)}</Text>
                      </div>

                      {job.quantityAvailable && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TeamOutlined style={{ color: '#666' }} />
                          <Text>
                            {Math.max(0, job.quantityAvailable - hiredCount)} of {job.quantityAvailable} position{job.quantityAvailable > 1 ? 's' : ''} remaining
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                </Col>

                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'right' }}>
                    <JobDetailActions jobId={job._id} quantityAvailable={job.quantityAvailable} />
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Main Content Card - directly below header */}
            <Card style={{ border: '0.5px solid lightgray', minHeight: 600 }}>
              {/* Job Overview Section */}
              <div style={{ marginBottom: 40 }}>
                <Title level={3} style={{ color: 'black', marginBottom: 16, fontSize: 20, fontWeight: 600, borderBottom: '2px solid black', paddingBottom: 8, width: 'fit-content' }}>
                  Job Overview
                </Title>
                <Paragraph style={{ fontSize: 16, lineHeight: 1.8, color: '#333', marginBottom: 0 }}>
                  {job.description || 'No description provided.'}
                </Paragraph>
              </div>


            {/* Role Overview Section */}
            <div style={{ marginBottom: 40 }}>
              <Title level={3} style={{ color: 'black', marginBottom: 16, fontSize: 20, fontWeight: 600, borderBottom: '2px solid black', paddingBottom: 8, width: 'fit-content' }}>
                Role Overview
              </Title>

              {job.project ? (
                <>
                  {job.project.title && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 16 }}>Project: </Text>
                      <Text style={{ fontSize: 16 }}>{job.project.title}</Text>
                    </div>
                  )}

                  {job.project.description && (
                    <Paragraph style={{ fontSize: 16, lineHeight: 1.8, color: '#333', marginBottom: 16 }}>
                      {job.project.description}
                    </Paragraph>
                  )}

                  {job.project.roleDescription && (
                    <Paragraph style={{ fontSize: 16, lineHeight: 1.8, color: '#333', marginBottom: 16 }}>
                      {job.project.roleDescription}
                    </Paragraph>
                  )}

                  {/* Project Timeline */}
                  {(job.project.startDate || job.project.endDate) && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Project Timeline:</Text>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {job.project.startDate && (
                          <span style={{ color: '#666' }}>
                            <CalendarOutlined style={{ marginRight: 6 }} />
                            Start: {formatDate(job.project.startDate)}
                          </span>
                        )}
                        {job.project.endDate && (
                          <span style={{ color: '#666' }}>
                            <CalendarOutlined style={{ marginRight: 6 }} />
                            End: {formatDate(job.project.endDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Project Locations */}
                  {job.project.locations && job.project.locations.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Project Locations:</Text>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {job.project.locations.map((location, index) => (
                          <Tag key={index} style={{ padding: '4px 12px', fontSize: 14 }}>
                            {location}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Areas of Interest */}
                  {job.project.areasOfInterest && job.project.areasOfInterest.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Areas of Interest:</Text>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {job.project.areasOfInterest.map((area, index) => (
                          <Tag key={index} color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>
                            {area}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 16 }}>No role overview information provided.</Text>
              )}
            </div>

            {/* Requirements Section */}
            <div style={{ marginBottom: 40 }}>
              <Title level={3} style={{ color: 'black', marginBottom: 16, fontSize: 20, fontWeight: 600, borderBottom: '2px solid black', paddingBottom: 8, width: 'fit-content' }}>
                Requirements
              </Title>
              {job.requirements && job.requirements.length > 0 ? (
                <ul style={{ fontSize: 16, lineHeight: 1.8, color: '#333', paddingLeft: 20 }}>
                  {job.requirements.map((requirement, index) => (
                    <li key={index} style={{ marginBottom: 8 }}>
                      {requirement}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary" style={{ fontSize: 16 }}>No specific requirements listed.</Text>
              )}
            </div>

            {/* Responsibilities Section */}
            <div style={{ marginBottom: 40 }}>
              <Title level={3} style={{ color: 'black', marginBottom: 16, fontSize: 20, fontWeight: 600, borderBottom: '2px solid black', paddingBottom: 8, width: 'fit-content' }}>
                Responsibilities
              </Title>
              {job.responsibilities && job.responsibilities.length > 0 ? (
                <ul style={{ fontSize: 16, lineHeight: 1.8, color: '#333', paddingLeft: 20 }}>
                  {job.responsibilities.map((responsibility, index) => (
                    <li key={index} style={{ marginBottom: 8 }}>
                      {responsibility}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary" style={{ fontSize: 16 }}>No specific responsibilities listed.</Text>
              )}
            </div>

            {/* Job Information Section */}
            <div style={{ marginBottom: 40 }}>
              <Title level={3} style={{ color: 'black', marginBottom: 16, fontSize: 20, fontWeight: 600, borderBottom: '2px solid black', paddingBottom: 8, width: 'fit-content' }}>
                More Info
              </Title>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>Position:</Text>
                  <Text style={{ fontSize: 16, color: '#666' }}>{job.position || 'Intern'}</Text>
                </div>
                <div>
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>Posted:</Text>
                  <Text style={{ fontSize: 16, color: '#666' }}>{formatDate(job.createdAt)}</Text>
                </div>
                {job.publishAt && (
                  <div>
                    <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>Published:</Text>
                    <Text style={{ fontSize: 16, color: '#666' }}>{formatDate(job.publishAt)}</Text>
                  </div>
                )}
                {job.expiresAt && (
                  <div>
                    <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>Expires:</Text>
                    <Text style={{ fontSize: 16, color: '#666' }}>
                      <ClockCircleOutlined style={{ marginRight: 6 }} />
                      {formatDate(job.expiresAt)}
                    </Text>
                  </div>
                )}
              </div>
            </div>

            {/* Onboarding Materials Section */}
            <div style={{ marginBottom: 40 }}>
              <Title level={3} style={{ color: 'black', marginBottom: 16, fontSize: 20, fontWeight: 600, borderBottom: '2px solid black', paddingBottom: 8, width: 'fit-content' }}>
                Onboarding Materials
              </Title>
              {job.onboardingMaterials && job.onboardingMaterials.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {job.onboardingMaterials.map((material, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 16,
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      backgroundColor: '#fafafa'
                    }}>
                      <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                      <div>
                        <Text strong style={{ fontSize: 16 }}>{material.label || material.type}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 14 }}>
                          {material.type}
                        </Text>
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 16 }}>No onboarding materials available.</Text>
              )}
            </div>
            </Card>
          </Col>

          {/* Right: Similar Jobs */}
          <Col xs={24} lg={8}>
            <SimilarJobs currentJob={job} />
          </Col>
        </Row>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

