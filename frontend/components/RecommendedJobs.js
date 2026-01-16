"use client";
import { useState, useEffect } from 'react';
import { Card, Space, Typography, Spin, Avatar, theme as antdTheme } from 'antd';
import { EnvironmentOutlined, BankOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { formatDate } from '../utils/formatters';
import { API_BASE_URL } from '../config';

const { Text } = Typography;

export default function RecommendedJobs({ user }) {
  const { token } = antdTheme.useToken();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoUrls, setLogoUrls] = useState({});

  useEffect(() => {
    const fetchRecommendedJobs = async () => {
      try {
        setLoading(true);

        // Build query based on user preferences
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
      } catch (err) {
        console.error('Error fetching recommended jobs:', err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRecommendedJobs();
    }
  }, [user]);

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
          <span>Recommended for You</span>
          <Link href="/jobs">
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
      {jobs.length === 0 ? (
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
      )}
    </Card>
  );
}

