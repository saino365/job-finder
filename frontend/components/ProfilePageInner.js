"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layout, Card, Typography, Button, Space, Upload, Avatar, App, Tag, Progress, Row, Col, theme as antdTheme } from 'antd';
import { UploadOutlined, EditOutlined, PhoneOutlined, MailOutlined, FileTextOutlined, WarningOutlined, CalendarOutlined, EnvironmentOutlined, BookOutlined, DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Navbar from './Navbar';
import Footer from './Footer';
import { API_BASE_URL } from '../config';
import EditProfileModal from './EditProfileModal';
import RecommendedJobs from './RecommendedJobs';

const { Title, Text } = Typography;

function ProfilePageInner({ user, isOwner, fullName, onUploadAvatar, onUploadResume, onEditClick, onEditSection, viewFile }) {
  const { token } = antdTheme.useToken();
  const [avatarError, setAvatarError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Generate signed URL for avatar display
  useEffect(() => {
    async function loadAvatar() {
      if (user?.profile?.avatar) {
        try {
          const res = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(user.profile.avatar)}`);
          if (res.ok) {
            const data = await res.json();
            setAvatarUrl(data.signedUrl);
          } else {
            setAvatarUrl(user.profile.avatar); // Fallback to original URL
          }
        } catch (e) {
          console.error('Failed to get signed URL:', e);
          setAvatarUrl(user.profile.avatar); // Fallback to original URL
        }
      } else {
        setAvatarUrl(null);
      }
    }
    loadAvatar();
  }, [user?.profile?.avatar]);

  // Extract filename from URL
  const getFilenameFromUrl = (url) => {
    if (!url) return 'Document';
    try {
      // Extract the last part of the URL path
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      // Remove query parameters if any
      const cleanFilename = filename.split('?')[0];
      // Decode URL encoding
      return decodeURIComponent(cleanFilename);
    } catch (e) {
      return 'Document';
    }
  };

  // Calculate profile completion score
  const calculateProfileScore = () => {
    let score = 0;
    const checks = [
      { condition: user?.profile?.firstName && user?.profile?.lastName, points: 10 },
      { condition: user?.profile?.phone, points: 5 },
      { condition: user?.internProfile?.university, points: 8 },
      { condition: user?.internProfile?.major, points: 8 },
      { condition: user?.internProfile?.gpa, points: 5 },
      { condition: user?.internProfile?.graduationYear, points: 5 },
      { condition: user?.internProfile?.resume, points: 15 },
      { condition: user?.internProfile?.educations?.length > 0, points: 10 },
      { condition: user?.internProfile?.workExperiences?.length > 0, points: 8 },
      { condition: user?.internProfile?.skills?.length > 0, points: 8 },
      { condition: user?.internProfile?.languages?.length > 0, points: 5 },
      { condition: user?.internProfile?.certifications?.length > 0, points: 5 },
      { condition: user?.internProfile?.preferences?.industries?.length > 0, points: 4 },
      { condition: user?.internProfile?.preferences?.locations?.length > 0, points: 4 },
    ];

    checks.forEach(check => {
      if (check.condition) score += check.points;
    });

    return score;
  };

  // Get pending actions (missing profile sections)
  const getPendingActions = () => {
    const actions = [];

    if (!user?.internProfile?.resume) {
      actions.push({ label: 'Upload Resume', section: 'personal', points: 15 });
    }
    if (!user?.internProfile?.educations || user.internProfile.educations.length === 0) {
      actions.push({ label: 'Add Education', section: 'education', points: 10 });
    }
    if (!user?.internProfile?.skills || user.internProfile.skills.length === 0) {
      actions.push({ label: 'Add Skills', section: 'skills', points: 8 });
    }
    if (!user?.internProfile?.workExperiences || user.internProfile.workExperiences.length === 0) {
      actions.push({ label: 'Add Work Experience', section: 'experience', points: 8 });
    }
    if (!user?.internProfile?.university) {
      actions.push({ label: 'Add University', section: 'personal', points: 8 });
    }
    if (!user?.internProfile?.major) {
      actions.push({ label: 'Add Major', section: 'personal', points: 8 });
    }
    if (!user?.internProfile?.languages || user.internProfile.languages.length === 0) {
      actions.push({ label: 'Add Languages', section: 'skills', points: 5 });
    }
    if (!user?.internProfile?.certifications || user.internProfile.certifications.length === 0) {
      actions.push({ label: 'Add Certifications', section: 'certifications', points: 5 });
    }
    if (!user?.internProfile?.gpa) {
      actions.push({ label: 'Add GPA', section: 'personal', points: 5 });
    }
    if (!user?.profile?.phone) {
      actions.push({ label: 'Add Phone Number', section: 'personal', points: 5 });
    }
    if (!user?.internProfile?.graduationYear) {
      actions.push({ label: 'Add Graduation Year', section: 'personal', points: 5 });
    }
    if (!user?.internProfile?.preferences?.industries || user.internProfile.preferences.industries.length === 0) {
      actions.push({ label: 'Set Industry Preferences', section: 'internship', points: 4 });
    }
    if (!user?.internProfile?.preferences?.locations || user.internProfile.preferences.locations.length === 0) {
      actions.push({ label: 'Set Location Preferences', section: 'internship', points: 4 });
    }

    return actions;
  };

  const profileScore = calculateProfileScore();
  const pendingActions = getPendingActions();

  return (
    <Row gutter={[24, 24]}>
      {/* Left Sidebar - Fixed (Profile Card, Score, Pending Actions) */}
      <Col xs={24} lg={6}>
        <div style={{ position: 'sticky', top: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Profile Header */}
          <Card style={{ textAlign: 'center', position: 'relative', boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" }}>
            {!isOwner && (
              <div style={{ position: 'absolute', top: 16, right: 16 }}>
                <Tag color="purple" style={{ borderRadius: 12 }}>Recruiter&apos;s view</Tag>
              </div>
            )}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              <Avatar
                size={80}
                src={!avatarError && avatarUrl ? avatarUrl : undefined}
                style={{ backgroundColor: '#7d69ff', fontSize: '32px', fontWeight: 'bold' }}
                onError={() => {
                  setAvatarError(true);
                  return true;
                }}
              >
                {fullName(user).charAt(0)}
              </Avatar>
              {isOwner && (
                <Upload
                  beforeUpload={onUploadAvatar}
                  maxCount={1}
                  accept="image/*"
                  showUploadList={false}
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<EditOutlined />}
                    style={{
                      position: 'absolute',
                      bottom: -5,
                      right: -5,
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  />
                </Upload>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <Title level={4} style={{ margin: 0 }}>{fullName(user)}</Title>
              {isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={onEditClick} />}
            </div>
            {user?.internProfile?.university && (
              <Text style={{ fontSize: 16, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                {user.internProfile.university}
              </Text>
            )}
            {user?.internProfile?.major && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {user.internProfile.major}
              </Text>
            )}
            {(user?.internProfile?.gpa || user?.internProfile?.graduationYear || user?.profile?.icPassportNumber) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'left', marginBottom: 16 }}>
                {user?.internProfile?.gpa && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>GPA</Text>
                    <Text strong>{user.internProfile.gpa}</Text>
                  </div>
                )}
                {user?.internProfile?.graduationYear && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Graduation</Text>
                    <Text strong>{user.internProfile.graduationYear}</Text>
                  </div>
                )}
                {user?.profile?.icPassportNumber && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>IC/Passport</Text>
                    <Text strong>{user.profile.icPassportNumber}</Text>
                  </div>
                )}
              </div>
            )}
            {user?.updatedAt && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                Profile last updated on: {new Date(user.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
            <div style={{ textAlign: 'left' }}>
              {user?.profile?.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <PhoneOutlined />
                  <Text>{user.profile.phone}</Text>
                </div>
              )}
              {user?.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <MailOutlined />
                  <Text>{user.email}</Text>
                </div>
              )}
              {isOwner && (
                <Button
                  type="primary"
                  block
                  icon={<EditOutlined />}
                  onClick={onEditClick}
                  style={{ marginTop: 8, background: 'linear-gradient(to right, #7d69ff, #917fff)', border: 'none', borderRadius: '25px', fontSize: '16px', fontWeight: '600', padding: '8px 25px', height: 'auto', boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)"  }}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </Card>

          {/* Profile Score */}
          <Card style={{boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)"}}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                <Progress
                  type="circle"
                  percent={profileScore}
                  size={80}
                  strokeColor={profileScore === 100 ? "#52c41a" : "#ff7a00"}
                  format={() => <span style={{ fontSize: 18, fontWeight: 'bold' }}>{profileScore}%</span>}
                />
              </div>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>Profile score</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {profileScore === 100
                  ? "Perfect! Your profile is complete!"
                  : "Recruiters seek 100% profiles - complete yours to stand out!"}
              </Text>
            </div>
          </Card>

          {/* Pending Actions */}
          {isOwner && pendingActions.length > 0 && (
            <Card
              title={<Text strong style={{ fontSize: 16 }}>Pending Actions</Text>}
              style={{
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
                border: `1px solid ${token.colorBorder}`,
                borderRadius: 8,
                backgroundColor: token.colorBgContainer
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {pendingActions.map((action, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: token.colorWarningBg || '#fff7e6',
                      borderRadius: 6,
                      border: '1px solid #ffd591',
                      cursor: 'pointer'
                    }}
                    onClick={() => onEditSection(action.section)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <WarningOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                      <Text style={{ fontSize: 14, color: token.colorText }}>{action.label}</Text>
                    </div>
                    <Tag color="orange" style={{ margin: 0 }}>+{action.points}%</Tag>
                  </div>
                ))}
              </Space>
            </Card>
          )}

          {/* Profile Complete Message */}
          {isOwner && pendingActions.length === 0 && (
            <Card
              style={{
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
                border: `1px solid #52c41a`,
                borderRadius: 8,
                backgroundColor: '#f6ffed'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                <Title level={5} style={{ margin: 0, marginBottom: 4, color: '#52c41a' }}>Profile Complete!</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Your profile is 100% complete. Great job!
                </Text>
              </div>
            </Card>
          )}
        </Space>
        </div>
      </Col>

      {/* Middle Content - Scrollable sections */}
      <Col xs={24} lg={12}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>

          {/* Internship Section */}
          <Card
            title={<Text strong style={{ fontSize: 18 }}>Internship Details</Text>}
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('internship')} />}
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              backgroundColor: token.colorBgContainer
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={16}>

              {/* Duration */}
              {(user?.internProfile?.preferences?.preferredStartDate || user?.internProfile?.preferences?.preferredEndDate) ? (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Duration</Text>
                  <Text style={{ fontSize: 14 }}>
                    {(() => {
                      const startDate = user.internProfile.preferences.preferredStartDate;
                      const endDate = user.internProfile.preferences.preferredEndDate;

                      if (!startDate && !endDate) return 'Not specified';

                      const formatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
                      const startStr = startDate ? new Date(startDate).toLocaleDateString('en-GB', formatOptions) : '';
                      const endStr = endDate ? new Date(endDate).toLocaleDateString('en-GB', formatOptions) : '';

                      // If both dates are the same, show only one date
                      if (startDate && endDate && startDate === endDate) {
                        return startStr;
                      }

                      // If both dates exist and are different, show range
                      if (startStr && endStr) {
                        return `${startStr} - ${endStr}`;
                      }

                      // If only one date exists
                      return startStr || endStr;
                    })()}
                  </Text>
                </div>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Duration</Text>
                  <Text type="secondary" italic>Please specify your preferred internship duration</Text>
                </div>
              )}

              {/* Preferred Industry */}
              {user?.internProfile?.preferences?.industries && user.internProfile.preferences.industries.length > 0 ? (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Preferred Industry</Text>
                  <Space wrap size="small">
                    {user.internProfile.preferences.industries.map((industry, idx) => (
                      <Tag key={idx} color="purple">{industry}</Tag>
                    ))}
                  </Space>
                </div>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Preferred Industry</Text>
                  <Text type="secondary" italic>No industry preferences specified</Text>
                </div>
              )}

              {/* Preferred Location */}
              {user?.internProfile?.preferences?.locations && user.internProfile.preferences.locations.length > 0 ? (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Preferred Location (1-3)</Text>
                  <Space wrap size="small">
                    {user.internProfile.preferences.locations.slice(0, 3).map((location, idx) => (
                      <Tag key={idx} color="geekblue" icon={<EnvironmentOutlined />}>{location}</Tag>
                    ))}
                  </Space>
                </div>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Preferred Location (1-3)</Text>
                  <Text type="secondary" italic>No location preferences specified</Text>
                </div>
              )}

              {/* Preferred Salary Range */}
              {(user?.internProfile?.preferences?.salaryRange?.min || user?.internProfile?.preferences?.salaryRange?.max) ? (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Preferred Salary Range</Text>
                  <Text style={{ fontSize: 14 }}>
                    RM {user.internProfile.preferences.salaryRange.min || 0} - RM {user.internProfile.preferences.salaryRange.max || 0}
                  </Text>
                </div>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Preferred Salary Range</Text>
                  <Text type="secondary" italic>No salary range specified</Text>
                </div>
              )}

              {/* Skills */}
              {user?.internProfile?.skills && user.internProfile.skills.length > 0 ? (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Skills</Text>
                  <Space wrap size="small">
                    {user.internProfile.skills.map((skill, idx) => (
                      <Tag key={idx} color="green">{skill}</Tag>
                    ))}
                  </Space>
                </div>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Skills</Text>
                  <Text type="secondary" italic>No skills listed</Text>
                </div>
              )}

              {/* Languages */}
              {user?.internProfile?.languages && user.internProfile.languages.length > 0 ? (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Languages</Text>
                  <Space wrap size="small">
                    {user.internProfile.languages.map((language, idx) => (
                      <Tag key={idx} color="cyan">{language}</Tag>
                    ))}
                  </Space>
                </div>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Languages</Text>
                  <Text type="secondary" italic>No languages specified</Text>
                </div>
              )}

              {/* Course Information */}
              {user?.internProfile?.courses && user.internProfile.courses.length > 0 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>Course Information</Text>
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {user.internProfile.courses.map((course, idx) => (
                      <div key={idx} style={{ paddingBottom: idx < user.internProfile.courses.length - 1 ? 12 : 0, borderBottom: idx < user.internProfile.courses.length - 1 ? `1px solid ${token.colorBorder}` : 'none' }}>
                        {course.courseId && (
                          <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                            <BookOutlined /> {course.courseId}
                          </Text>
                        )}
                        {course.courseName && (
                          <Text style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                            {course.courseName}
                          </Text>
                        )}
                        {course.courseDescription && (
                          <Text type="secondary" style={{ display: 'block', fontSize: 14 }}>
                            {course.courseDescription}
                          </Text>
                        )}
                      </div>
                    ))}
                  </Space>
                </div>
              )}

              {/* Assignment Information */}
              {user?.internProfile?.assignments && user.internProfile.assignments.length > 0 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>Assignments</Text>
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {user.internProfile.assignments.map((assignment, idx) => (
                      <div key={idx} style={{ paddingBottom: idx < user.internProfile.assignments.length - 1 ? 12 : 0, borderBottom: idx < user.internProfile.assignments.length - 1 ? `1px solid ${token.colorBorder}` : 'none' }}>
                        {assignment.title && (
                          <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                            {assignment.title}
                          </Text>
                        )}
                        {assignment.natureOfAssignment && (
                          <div style={{ marginBottom: 4 }}>
                            <Tag color="orange">Nature: {assignment.natureOfAssignment}</Tag>
                          </div>
                        )}
                        {assignment.methodology && (
                          <Text style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                            <strong>Methodology:</strong> {assignment.methodology}
                          </Text>
                        )}
                        {assignment.description && (
                          <Text type="secondary" style={{ display: 'block', fontSize: 14 }}>
                            {assignment.description}
                          </Text>
                        )}
                      </div>
                    ))}
                  </Space>
                </div>
              )}

            </Space>
          </Card>

          {/* Job Preferences Card */}
          <Card
            title="Job Preferences"
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('preferences')} />}
            style={{ boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)", minHeight: 150 }}
          >
            {user?.internProfile?.preferences?.jobTypes && user.internProfile.preferences.jobTypes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Preferred Job Types</Text>
                <Space wrap size="small">
                  {user.internProfile.preferences.jobTypes.map((type, idx) => (
                    <Tag key={idx} color="blue">{type}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {user?.internProfile?.preferences?.locations && user.internProfile.preferences.locations.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Preferred Locations</Text>
                <Space wrap size="small">
                  {user.internProfile.preferences.locations.map((loc, idx) => (
                    <Tag key={idx} color="green"><EnvironmentOutlined /> {loc}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {user?.internProfile?.preferences?.industries && user.internProfile.preferences.industries.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Preferred Industries</Text>
                <Space wrap size="small">
                  {user.internProfile.preferences.industries.map((ind, idx) => (
                    <Tag key={idx} color="purple">{ind}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {(!user?.internProfile?.preferences ||
              (!user.internProfile.preferences.jobTypes?.length &&
               !user.internProfile.preferences.locations?.length &&
               !user.internProfile.preferences.industries?.length)) && (
              <Text type="secondary">No job preferences set</Text>
            )}
          </Card>

          {/* Resume Card */}
          <Card
            title="Resume"
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              minHeight: 150,
              backgroundColor: token.colorBgContainer
            }}
          >
            {user?.internProfile?.resume ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileTextOutlined />
                    <Text strong>{user.internProfile.resumeOriginalName || getFilenameFromUrl(user.internProfile.resume)}</Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={() => viewFile(user.internProfile.resume)}
                  >
                    Download
                  </Button>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>(*doc, docx, rtf, pdf Max file size is 6MB)</Text>
                {isOwner && (
                  <div style={{ marginTop: 8 }}>
                    <Upload
                      beforeUpload={onUploadResume}
                      maxCount={1}
                      accept=".pdf,.doc,.docx,.rtf"
                      showUploadList={false}
                    >
                      <Button type="link" style={{ padding: 0 }}>Replace resume</Button>
                    </Upload>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>No resume uploaded</Text>
                {isOwner && (
                  <Upload
                    beforeUpload={onUploadResume}
                    maxCount={1}
                    accept=".pdf,.doc,.docx,.rtf"
                    showUploadList={false}
                  >
                    <Button type="primary" icon={<UploadOutlined />}>Upload resume</Button>
                  </Upload>
                )}
              </div>
            )}
          </Card>

          {/* Education Card */}
          <Card
            title={<Text strong style={{ fontSize: 18 }}>Education</Text>}
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('education')} />}
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              backgroundColor: token.colorBgContainer
            }}
          >
            {user?.internProfile?.educations && user.internProfile.educations.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size={0} split={<div style={{ borderBottom: `1px solid ${token.colorBorder}`, margin: '16px 0' }} />}>
                {user.internProfile.educations.map((edu, idx) => (
                  <div key={idx} style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <Text strong style={{ fontSize: 16, display: 'block', color: token.colorText }}>
                          {edu.qualification || edu.level}
                        </Text>
                        {edu.institutionName && (
                          <Text style={{ display: 'block', marginTop: 2, fontSize: 14, color: token.colorText }}>
                            {edu.institutionName}
                          </Text>
                        )}
                        {edu.fieldOfStudy && (
                          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 14 }}>
                            {edu.fieldOfStudy}
                          </Text>
                        )}
                        {(edu.startDate || edu.endDate) && (
                          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 14 }}>
                            <CalendarOutlined /> {edu.startDate ? new Date(edu.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''}
                            {edu.endDate ? ` - ${new Date(edu.endDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ' - Present'}
                          </Text>
                        )}
                        {edu.gpa && (
                          <Text type="secondary" style={{ display: 'block', marginTop: 2, fontSize: 14 }}>
                            GPA: {edu.gpa}
                          </Text>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No education records added</Text>
            )}
          </Card>

          {/* Work Experience Card */}
          <Card
            title={<Text strong style={{ fontSize: 18 }}>Work Experience</Text>}
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('experience')} />}
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              backgroundColor: token.colorBgContainer
            }}
          >
            {user?.internProfile?.workExperiences && user.internProfile.workExperiences.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size={0} split={<div style={{ borderBottom: `1px solid ${token.colorBorder}`, margin: '16px 0' }} />}>
              {user.internProfile.workExperiences.map((work, idx) => (
                <div key={idx} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', color: token.colorText }}>
                        {work.jobTitle}
                      </Text>
                      {work.companyName && (
                        <Text style={{ display: 'block', marginTop: 2, fontSize: 14, color: token.colorText }}>
                          {work.companyName} · {work.employmentType || 'Full-time'}
                        </Text>
                      )}
                      {(work.startDate || work.endDate) && (
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 14 }}>
                          {work.startDate ? new Date(work.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''}
                          {work.endDate ? ` - ${new Date(work.endDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ' - Present'}
                        </Text>
                      )}
                      {work.location && (
                        <Text type="secondary" style={{ display: 'block', marginTop: 2, fontSize: 14 }}>
                          {work.location}
                        </Text>
                      )}
                      {work.jobDescription && (
                        <Text style={{ display: 'block', marginTop: 12, fontSize: 14, color: token.colorText, lineHeight: 1.6 }}>
                          {work.jobDescription}
                        </Text>
                      )}
                      {work.industry && (
                        <div style={{ marginTop: 12 }}>
                          <Text strong style={{ fontSize: 14, color: token.colorText }}>
                            {work.industry}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Space>
            ) : (
              <Text type="secondary">No work experience added</Text>
            )}
          </Card>

          {/* Certifications Card */}
          <Card
            title={<Text strong style={{ fontSize: 18 }}>Licenses & Certifications</Text>}
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('certifications')} />}
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              backgroundColor: token.colorBgContainer
            }}
          >
          {user?.internProfile?.certifications && user.internProfile.certifications.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size={0} split={<div style={{ borderBottom: `1px solid ${token.colorBorder}`, margin: '16px 0' }} />}>
              {user.internProfile.certifications.map((cert, idx) => (
                <div key={idx} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', color: token.colorText }}>
                        {cert.title}
                      </Text>
                      {cert.issuer && (
                        <Text style={{ display: 'block', marginTop: 2, fontSize: 14, color: token.colorText }}>
                          {cert.issuer}
                        </Text>
                      )}
                      {cert.acquiredDate && (
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 14 }}>
                          Issued {new Date(cert.acquiredDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                      {cert.description && (
                        <Text style={{ display: 'block', marginTop: 12, fontSize: 14, color: token.colorText, lineHeight: 1.6 }}>
                          {cert.description}
                        </Text>
                      )}
                      {cert.fileUrl && (
                        <div style={{ marginTop: 12 }}>
                          <Button
                            type="default"
                            icon={<DownloadOutlined />}
                            size="small"
                            onClick={() => viewFile(cert.fileUrl)}
                            style={{ borderRadius: 16, fontSize: 13, height: 28 }}
                          >
                            Show credential
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Space>
            ) : (
              <Text type="secondary">No certifications added</Text>
            )}
          </Card>

          {/* Event Experiences Card */}
          <Card
            title={<Text strong style={{ fontSize: 18 }}>Event Experiences</Text>}
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('events')} />}
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              backgroundColor: token.colorBgContainer
            }}
          >
          {user?.internProfile?.eventExperiences && user.internProfile.eventExperiences.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size={0} split={<div style={{ borderBottom: `1px solid ${token.colorBorder}`, margin: '16px 0' }} />}>
              {user.internProfile.eventExperiences.map((event, idx) => (
                <div key={idx} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', color: token.colorText }}>
                        {event.eventName}
                      </Text>
                      {event.position && (
                        <Text style={{ display: 'block', marginTop: 2, fontSize: 14, color: token.colorText }}>
                          {event.position}
                        </Text>
                      )}
                      {(event.startDate || event.endDate) && (
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 14 }}>
                          <CalendarOutlined /> {event.startDate ? new Date(event.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''}
                          {event.endDate ? ` - ${new Date(event.endDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ' - Present'}
                        </Text>
                      )}
                      {event.location && (
                        <Text type="secondary" style={{ display: 'block', marginTop: 2, fontSize: 14 }}>
                          <EnvironmentOutlined /> {event.location}
                        </Text>
                      )}
                      {event.description && (
                        <Text style={{ display: 'block', marginTop: 12, fontSize: 14, color: token.colorText, lineHeight: 1.6 }}>
                          {event.description}
                        </Text>
                      )}
                      {event.socialLinks && event.socialLinks.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Space wrap size="small">
                            {event.socialLinks.map((link, linkIdx) => (
                              <Button
                                key={linkIdx}
                                type="link"
                                size="small"
                                href={link}
                                target="_blank"
                                style={{ padding: 0, height: 'auto' }}
                              >
                                {link}
                              </Button>
                            ))}
                          </Space>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Space>
            ) : (
              <Text type="secondary">No event experiences added</Text>
            )}
          </Card>

          {/* Interests Card */}
          <Card
            title={<Text strong style={{ fontSize: 18 }}>Interests</Text>}
            extra={isOwner && <Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEditSection('interests')} />}
            style={{
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              backgroundColor: token.colorBgContainer
            }}
          >
          {user?.internProfile?.interests && user.internProfile.interests.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size={0} split={<div style={{ borderBottom: `1px solid ${token.colorBorder}`, margin: '16px 0' }} />}>
              {user.internProfile.interests.map((interest, idx) => (
                <div key={idx} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 16, display: 'block', color: token.colorText }}>
                        {interest.title}
                      </Text>
                      {interest.description && (
                        <Text style={{ display: 'block', marginTop: 8, fontSize: 14, color: token.colorText, lineHeight: 1.6 }}>
                          {interest.description}
                        </Text>
                      )}
                      {interest.socialLinks && interest.socialLinks.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Space wrap size="small">
                            {interest.socialLinks.map((link, linkIdx) => (
                              <Button
                                key={linkIdx}
                                type="link"
                                size="small"
                                href={link}
                                target="_blank"
                                style={{ padding: 0, height: 'auto' }}
                              >
                                {link}
                              </Button>
                            ))}
                          </Space>
                        </div>
                      )}
                    </div>
                    {interest.thumbnailUrl && (
                      <div style={{ flexShrink: 0 }}>
                        <img
                          src={interest.thumbnailUrl}
                          alt={interest.title}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Space>
            ) : (
              <Text type="secondary">No interests added</Text>
            )}
          </Card>

        </Space>
      </Col>

      {/* Right Sidebar - Recommended Jobs */}
      <Col xs={24} lg={6}>
        <div style={{ position: 'sticky', top: 24 }}>
          <RecommendedJobs user={user} />
        </div>
      </Col>
    </Row>
  );
}

function ProfilePageContent() {
  const { message } = App.useApp();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSection, setEditSection] = useState('personal');

  const searchParams = useSearchParams();
  const idParam = searchParams?.get('id') ?? null;

  const fullName = useCallback((u) => {
    const p = u?.profile || {};
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Unnamed User';
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('jf_token');
        if (!token) {
          message.info('Please sign in');
          window.location.href = '/login';
          return;
        }
        const meRes = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!meRes.ok) throw new Error('Failed to load profile');
        const me = await meRes.json();

        const idToLoad = idParam || 'me';
        const res = await fetch(`${API_BASE_URL}/users/${idToLoad}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          if (res.status === 404) { message.warning('Profile not found'); } else { throw new Error('Failed to load profile'); }
          setUser(null);
          return;
        }
        const u = await res.json();
        setUser(u);

        const owner = !idParam || (me?._id && String(me._id) === String(u?._id));
        setIsOwner(!!owner);
      } catch (e) {
        message.error(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [idParam]);

  const reloadUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('jf_token');
      const searchParams = new URLSearchParams(window.location.search);
      const idToLoad = searchParams.get('id') || 'me';
      const res = await fetch(`${API_BASE_URL}/users/${idToLoad}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      }
    } catch (e) {
      console.error('Failed to reload user data:', e);
    }
  }, []);

  const onUploadAvatar = useCallback(async (file) => {
    try {
      const token = localStorage.getItem('jf_token');
      const fd = new FormData();
      fd.append('avatar', file);
      message.loading('Uploading avatar...', 0);
      const up = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!up.ok) {
        const errorText = await up.text();
        throw new Error(errorText || 'Upload failed');
      }
      const data = await up.json();
      // Use public URL instead of signedUrl (signedUrl expires after 1 hour)
      const url = data?.files?.avatar?.[0]?.url || data?.files?.avatar?.[0]?.signedUrl;
      if (url) {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 'profile.avatar': url })
        });
        if (res.ok) {
          message.destroy();
          message.success('Avatar updated!');
          await reloadUserData();
        } else {
          const errorText = await res.text();
          throw new Error(errorText || 'Failed to update avatar');
        }
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (e) {
      message.destroy();
      message.error(e.message || 'Upload failed');
      console.error('Avatar upload error:', e);
    }
    return false;
  }, [reloadUserData, message]);

  // Extract file key from S3 URL
  const getKeyFromUrl = useCallback((url) => {
    if (!url) return null;
    try {
      // URL format: https://endpoint/bucket/folder/filename
      // We need to extract: folder/filename
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      // Remove empty strings and bucket name (first two parts)
      const keyParts = pathParts.filter(Boolean).slice(1);
      return keyParts.join('/');
    } catch (e) {
      return null;
    }
  }, []);

  // Download file using backend signed URL
  const viewFile = useCallback(async (url) => {
    try {
      const key = getKeyFromUrl(url);
      if (!key) {
        message.error('Invalid file URL');
        return;
      }
      const token = localStorage.getItem('jf_token');
      const r = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      const signedUrl = j.signedUrl || j.publicUrl;
      if (signedUrl) window.open(signedUrl, '_blank'); else message.error('Failed to resolve file');
    } catch (e) { message.error(e.message || 'Failed to open file'); }
  }, [getKeyFromUrl, message]);

  const onUploadResume = useCallback(async (file) => {
    try {
      const token = localStorage.getItem('jf_token');
      const fd = new FormData();
      fd.append('resume', file);
      message.loading('Uploading resume...', 0);
      const up = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!up.ok) {
        let errorMsg = 'Upload failed';
        try {
          const errorData = await up.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (e) {
          const errorText = await up.text();
          if (errorText) errorMsg = errorText;
        }
        throw new Error(errorMsg);
      }
      const data = await up.json();
      const url = data?.files?.resume?.[0]?.url || data?.files?.resume?.[0]?.signedUrl;
      const originalName = data?.files?.resume?.[0]?.originalName;
      if (url) {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            'internProfile.resume': url,
            'internProfile.resumeOriginalName': originalName
          })
        });
        if (res.ok) {
          message.destroy();
          message.success('Resume uploaded!');
          await reloadUserData();
        } else {
          throw new Error('Failed to update resume');
        }
      }
    } catch (e) {
      message.destroy();
      message.error(e.message || 'Upload failed');
    }
    return false;
  }, [reloadUserData, message]);

  const onEditClick = useCallback(() => {
    setEditSection('personal');
    setEditModalVisible(true);
  }, []);

  const onEditSection = useCallback((section) => {
    setEditSection(section);
    setEditModalVisible(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setEditModalVisible(false);
  }, []);

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ maxWidth: 1800, margin: '24px auto', padding: '0 24px', width: '100%' }}>
        {loading ? (
          <Card loading={loading} style={{ minHeight: 400, minWidth: 1200 }} />
        ) : user ? (
          <>
            <ProfilePageInner
              user={user}
              isOwner={isOwner}
              fullName={fullName}
              onUploadAvatar={onUploadAvatar}
              onUploadResume={onUploadResume}
              onEditClick={onEditClick}
              onEditSection={onEditSection}
              viewFile={viewFile}
            />

            <EditProfileModal
              visible={editModalVisible}
              onClose={onCloseModal}
              user={user}
              onSuccess={reloadUserData}
              section={editSection}
            />
          </>
        ) : (
          <Card>
            <Text>Profile not found</Text>
          </Card>
        )}
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

export default ProfilePageContent;
