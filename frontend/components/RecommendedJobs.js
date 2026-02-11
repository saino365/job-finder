"use client";
import { useState, useEffect } from 'react';
import { Card, Space, Typography, Spin, Avatar, theme as antdTheme } from 'antd';
import { EnvironmentOutlined, BankOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { formatDate } from '../utils/formatters';
import { API_BASE_URL } from '../config';
import UserAvatar from './UserAvatar';

const { Text } = Typography;

export default function RecommendedJobs({ user }) {
  const { token } = antdTheme.useToken();
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoUrls, setLogoUrls] = useState({});
  const [viewerRole, setViewerRole] = useState('student');

  // Detect viewer's role
  useEffect(() => {
    const fetchViewerRole = async () => {
      try {
        const jwtToken = localStorage.getItem('jf_token');
        if (!jwtToken) return;
        
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${jwtToken}` }
        });
        
        if (res.ok) {
          const me = await res.json();
          setViewerRole(me?.role || 'student');
        }
      } catch (e) {
        console.error('Failed to fetch viewer role:', e);
      }
    };
    
    fetchViewerRole();
  }, []);

  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        setLoading(true);

        // If viewer is a company, fetch similar candidates
        if (viewerRole === 'company') {
          const queryParams = new URLSearchParams({
            $limit: 5,
            $sort: JSON.stringify({ createdAt: -1 })
          });

          // Use the viewed user's profile to find similar candidates
          const major = user?.internProfile?.major;
          const university = user?.internProfile?.university;
          const skills = user?.internProfile?.skills || [];

          if (major) queryParams.append('fieldOfStudy', major);
          if (university) queryParams.append('university', university);
          if (skills.length > 0) {
            skills.slice(0, 3).forEach(skill => queryParams.append('skills', skill));
          }

          const fetchUrl = `${API_BASE_URL}/programme-candidates?${queryParams}`;
          const response = await fetch(fetchUrl, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('jf_token')}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            const candidatesList = data.items || data.data || data || [];
            // Filter out the current user being viewed
            const filtered = candidatesList.filter(c => c._id !== user?._id && c.id !== user?._id);
            setCandidates(filtered.slice(0, 5));
          }
        } else {
          // Original job fetching logic for students
          let queryParams = new URLSearchParams({
            status: 2, // Active jobs only
            $limit: 5,
            $sort: JSON.stringify({ createdAt: -1 })
          });

          const preferences = user?.internProfile?.preferences;
          const major = user?.internProfile?.major;
          const skills = user?.internProfile?.skills || [];

          if (preferences?.industries && preferences.industries.length > 0) {
            preferences.industries.forEach((industry, index) => {
              queryParams.append('industry', industry);
            });
          }

          // D112: Add keyword search based on user's major and skills for better alignment
          const keywordParts = [];
          if (major) keywordParts.push(major);
          if (skills.length > 0) {
            // Add top 3 skills to keyword search
            keywordParts.push(...skills.slice(0, 3));
          }
          if (keywordParts.length > 0) {
            queryParams.append('keyword', keywordParts.join(' '));
          }

          const fetchUrl = `${API_BASE_URL}/job-listings?${queryParams}`;

          const response = await fetch(fetchUrl);

          if (!response.ok) {
            throw new Error(`Failed to fetch jobs: ${response.status}`);
          }

          const data = await response.json();
          let jobsList = data.data || data || [];

          // D112: Additional client-side filtering to improve alignment with user profile
          // Score jobs based on how well they match the user's profile
          if (major || skills.length > 0) {
            jobsList = jobsList.map(job => {
              let score = 0;
              const jobTitle = (job.title || '').toLowerCase();
              const jobDescription = (job.description || '').toLowerCase();
              const jobProfession = (job.profession || '').toLowerCase();
              const majorLower = (major || '').toLowerCase();
              
              // Check if job title/description/profession matches user's major
              if (major && (jobTitle.includes(majorLower) || jobDescription.includes(majorLower) || jobProfession.includes(majorLower))) {
                score += 10;
              }
              
              // Check if job matches user's skills
              if (skills.length > 0) {
                const jobText = `${jobTitle} ${jobDescription} ${jobProfession}`;
                const matchedSkills = skills.filter(skill => 
                  jobText.includes(skill.toLowerCase())
                );
                score += matchedSkills.length * 5;
              }
              
              return { ...job, _matchScore: score };
            }).sort((a, b) => {
              // Sort by match score (highest first), then by creation date
              if (b._matchScore !== a._matchScore) {
                return b._matchScore - a._matchScore;
              }
              return new Date(b.createdAt) - new Date(a.createdAt);
            }).map(({ _matchScore, ...job }) => job); // Remove score from final result
          }

          // Filter by preferred start date (D26, D27)
          if (preferences?.preferredStartDate || preferences?.startDate) {
            const userStartDate = preferences.preferredStartDate || preferences.startDate;
            const userStart = new Date(userStartDate);
            const twoMonthsBefore = new Date(userStart);
            twoMonthsBefore.setMonth(twoMonthsBefore.getMonth() - 2);
            const twoMonthsAfter = new Date(userStart);
            twoMonthsAfter.setMonth(twoMonthsAfter.getMonth() + 2);

            jobsList = jobsList.filter(job => {
              // Check both project.startDate and internshipStart
              const jobStartDate = job.project?.startDate || job.internshipStart;
              if (!jobStartDate) {
                return true; // Include jobs without start date
              }

              const start = new Date(jobStartDate);
              const isWithinRange = start >= twoMonthsBefore && start <= twoMonthsAfter;
              return isWithinRange;
            });
          }

          // Filter by salary range (D27) - fix for exact matches (min === max)
          if (preferences?.salaryRange) {
            const { min, max } = preferences.salaryRange;

            jobsList = jobsList.filter(job => {
              if (!job.salaryRange || job.salaryRange.min == null || job.salaryRange.max == null) {
                return true; // Include jobs without salary range
              }

              const jobMin = job.salaryRange.min;
              const jobMax = job.salaryRange.max;

              // Handle exact match case (e.g., RM 2000 - RM 2000)
              if (min != null && max != null) {
                if (min === max) {
                  // Exact match: job range should include this exact value
                  return jobMin <= min && jobMax >= max;
                } else {
                  // Range overlap: job's max >= filter min AND job's min <= filter max
                  return jobMax >= min && jobMin <= max;
                }
              } else if (min != null) {
                return jobMax >= min;
              } else if (max != null) {
                return jobMin <= max;
              }

              return true;
            });
          }

          // Filter by preferred duration (D26)
          if (preferences?.preferredDuration) {
            const preferredDuration = String(preferences.preferredDuration).toLowerCase();

            jobsList = jobsList.filter(job => {
              // Check both project dates and internship dates
              const startDate = job.project?.startDate || job.internshipStart;
              const endDate = job.project?.endDate || job.internshipEnd;
              
              if (!startDate || !endDate) {
                return true; // Include jobs without duration info
              }

              const start = new Date(startDate);
              const end = new Date(endDate);
              const durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
              const durationMonths = Math.round(durationDays / 30);

              // Extract number from preferred duration (e.g., "3 months", "6 months")
              const match = preferredDuration.match(/(\d+)/);
              if (!match) return true;

              const preferredMonths = parseInt(match[1]);
              // Allow ±1 month tolerance for matching
              const matches = Math.abs(durationMonths - preferredMonths) <= 1;

              return matches;
            });
          }

          setJobs(jobsList);

          // Load logos for all jobs
          loadLogos(jobsList);
        }
      } catch (err) {
        console.error('Error fetching recommended:', err);
        setJobs([]);
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    };

    if (user && viewerRole) {
      fetchRecommended();
    }
  }, [user, viewerRole]);

  const loadLogos = async (jobsList) => {
    const urls = {};
    for (const job of jobsList) {
      let logoUrl = job.company?.logo || job.company?.logoUrl || job.companyLogo;
      if (!logoUrl && job.company?.logoKey) {
        logoUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL || 'https://ap-southeast-mys1.oss.ips1cloud.com/job-finder-bucket'}/${job.company.logoKey}`;
      }

      if (logoUrl) {
        try {
          const res = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(logoUrl)}`);
          if (res.ok) {
            const data = await res.json();
            urls[job._id] = data.signedUrl;
          } else {
            urls[job._id] = logoUrl;
          }
        } catch (e) {
          urls[job._id] = logoUrl;
        }
      }
    }
    setLogoUrls(urls);
  };

  const getCompanyInitial = (companyName) => {
    return companyName ? companyName.charAt(0).toUpperCase() : 'C';
  };

  if (loading) {
    return (
      <Card
        title="Recommended for You"
        style={{
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 8,
          backgroundColor: token.colorBgContainer
        }}
      >
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin size="large" />
          <div style={{ marginTop: 8, color: token.colorText }}>Loading recommendations...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{viewerRole === 'company' ? 'Similar Candidates' : 'Recommended for You'}</span>
          <Link href={viewerRole === 'company' ? '/' : '/jobs'}>
            <Text style={{ fontSize: 14, color: token.colorPrimary, cursor: 'pointer' }}>View all</Text>
          </Link>
        </div>
      }
      style={{
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 8,
        backgroundColor: token.colorBgContainer
      }}
    >
      {viewerRole === 'company' ? (
        // Show candidates for company viewers
        candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Text type="secondary">No similar candidates found</Text>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {candidates.map((candidate) => {
              const profile = candidate?.profile || candidate?.user?.profile || {};
              const name = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || candidate?.email || 'Candidate';
              const edu = candidate?.internProfile?.educations?.[0] || candidate?.education?.[0] || {};
              const field = edu?.fieldOfStudy || edu?.major || 'Student';
              const university = edu?.university || candidate?.internProfile?.university || '';
              
              return (
                <Link key={candidate._id || candidate.id} href={`/profile/${candidate._id || candidate.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: 12,
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: 8,
                    backgroundColor: token.colorBgLayout,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = token.colorBgContainer;
                    e.currentTarget.style.borderColor = token.colorPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = token.colorBgLayout;
                    e.currentTarget.style.borderColor = token.colorBorder;
                  }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <UserAvatar
                        name={name}
                        avatarUrl={profile?.avatar || candidate?.avatar || ''}
                        size={40}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{
                          fontSize: 14,
                          display: 'block',
                          color: token.colorText,
                          marginBottom: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {name}
                        </Text>

                        <Text style={{ fontSize: 12, color: token.colorTextSecondary, display: 'block' }}>
                          {field}
                        </Text>

                        {university && (
                          <Text style={{ fontSize: 12, color: token.colorTextTertiary, display: 'block' }}>
                            {university}
                          </Text>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </Space>
        )
      ) : (
        // Show jobs for student viewers
        jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Text type="secondary">No recommendations available</Text>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {jobs.slice(0, 5).map((job, index) => (
              <Link key={job._id} href={`/jobs/${job._id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: 12,
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: 8,
                  backgroundColor: token.colorBgLayout,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = token.colorBgContainer;
                  e.currentTarget.style.borderColor = token.colorPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = token.colorBgLayout;
                  e.currentTarget.style.borderColor = token.colorBorder;
                }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Company Logo */}
                    <Avatar
                      size={40}
                      src={logoUrls[job._id]}
                      icon={<BankOutlined />}
                      style={{
                        backgroundColor: logoUrls[job._id] ? 'transparent' : token.colorBgLayout,
                        color: token.colorTextTertiary,
                        border: `1px solid ${token.colorBorder}`,
                        flexShrink: 0
                      }}
                    />

                    {/* Job Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{
                        fontSize: 14,
                        display: 'block',
                        color: token.colorText,
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {job.title}
                      </Text>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <BankOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} />
                        <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                          {job.company?.name || job.companyName || 'Company'}
                        </Text>
                      </div>

                      {job.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <EnvironmentOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} />
                          <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            {job.location.city}{job.location.state && `, ${job.location.state}`}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </Space>
        )
      )}
    </Card>
  );
}

