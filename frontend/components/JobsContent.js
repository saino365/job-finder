"use client";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { message } from "antd";
import { Row, Col, Input, Typography, Pagination, Card, Skeleton, Empty, Space, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Image from "next/image";
import JobCard from "./JobCard";
import FilterBar from "./FilterBar";
import { getFilterConfig } from "./filterConfigs";
import { API_BASE_URL } from "../config";
import { apiAuth, getToken } from "../lib/api";

const { Title, Text } = Typography;

export default function JobsContent() {
  // Search and filter states
  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [prefApplied, setPrefApplied] = useState(false);
  const [userApplications, setUserApplications] = useState([]);

  // Build query URL for jobs (using FeathersJS query syntax like JobsExplorer)
  const jobsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("$limit", "12");

    if (page > 1) {
      params.set("$skip", String((page - 1) * 12));
    }

    // Add keyword search - backend will handle title, description, and company name
    if (keyword?.trim()) {
      params.set("keyword", keyword.trim());
    }

    // Add filter parameters
    const { industry, location, salary, startDate } = filters;

    // Location filter using FeathersJS $or syntax
    if (location?.length > 0) {
      const loc = location[0];
      params.set("$or[0][location.city][$regex]", loc);
      params.set("$or[0][location.city][$options]", "i");
      params.set("$or[1][location.state][$regex]", loc);
      params.set("$or[1][location.state][$options]", "i");
    }

    // Salary filter using FeathersJS range syntax
    // Show jobs where salary ranges OVERLAP with the filter
    if (salary?.length > 0) {
      const salaryRange = salary[0];
      if (salaryRange === "5000+") {
        params.set("salaryRange.max[$gte]", "5000");
      } else if (salaryRange.includes(" - ")) {
        const [min, max] = salaryRange.split(" - ").map(s => s.trim());
        // For overlap: job's max >= filter min AND job's min <= filter max
        if (min) params.set("salaryRange.max[$gte]", min);
        if (max) params.set("salaryRange.min[$lte]", max);
      }
    }

    // Industry filter - pass as custom parameter for backend processing
    if (industry?.length > 0) {
      params.set("industry", industry[0]);
    }

    // Start date filter - pass as custom parameter for backend processing
    if (startDate?.length > 0) {
      params.set("startDate", startDate[0]);
    }

    // Sort by latest (default)
    params.set("$sort[createdAt]", "-1");

    return `${API_BASE_URL}/job-listings?${params.toString()}`;
  }, [keyword, filters, page]);

  // Load saved search profile
  const jobSearchProfileQuery = useQuery({
    queryKey: ['job-search-profile'],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/search-profiles?kind=job-search`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const items = data?.items || data?.data || [];
      return items[0] || null;
    },
    enabled: typeof window !== 'undefined',
    staleTime: 60_000,
  });

  // Apply saved preferences once
  useEffect(() => {
    if (prefApplied) return;
    const savedFilters = jobSearchProfileQuery.data?.filters;
    if (!savedFilters) return;

    console.log('📥 Loading saved job search profile:', savedFilters);

    const newFilters = {
      industry: savedFilters.industry || [],
      location: savedFilters.location || [],
      salary: savedFilters.salary || [],
      startDate: savedFilters.startDate || undefined,
    };

    setFilters(newFilters);
    if (savedFilters.keyword) setKeyword(savedFilters.keyword);
    setPrefApplied(true);
  }, [prefApplied, jobSearchProfileQuery.data]);

  // Fetch all user applications once to avoid N+1 queries
  useEffect(() => {
    (async () => {
      if (!getToken()) return;
      try {
        const apps = await apiAuth('/applications?$limit=1000', { method: 'GET' });
        const appList = Array.isArray(apps?.data) ? apps.data : (Array.isArray(apps) ? apps : []);
        setUserApplications(appList);
      } catch (_) { /* ignore */ }
    })();
  }, []);

  // D155: Fix job search loading - ensure proper error handling and response parsing
  const jobsQuery = useQuery({
    queryKey: ["jobs", jobsUrl],
    queryFn: async () => {
      console.log("🔍 Frontend: Fetching jobs from:", jobsUrl);
      try {
        const response = await fetch(jobsUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Jobs fetch error:", response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        const data = await response.json();
        console.log("🔍 Frontend: Jobs response:", data);
        // Ensure data structure is correct
        if (Array.isArray(data)) {
          return { data, total: data.length };
        }
        return data || { data: [], total: 0 };
      } catch (error) {
        console.error("❌ Jobs query error:", error);
        throw error;
      }
    },
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
    retry: 2, // Retry failed requests
    retryDelay: 1000
  });

  // Handle filter changes
  const handleFilterChange = (filterKey, values) => {
    console.log("🔍 Frontend: Filter change:", { filterKey, values });
    setFilters(prev => ({
      ...prev,
      [filterKey]: values
    }));
    setPage(1); // Reset to first page when filters change
  };

  // Handle clear all filters
  const handleClearAllFilters = () => {
    console.log("🔍 Frontend: Clearing all filters");
    setFilters({});
    setKeyword("");
    setPage(1);
  };

  // Handle save search profile
  const handleSaveSearchProfile = async () => {
    try {
      const { industry, location, salary, startDate } = filters;

      await apiAuth('/search-profiles', {
        method: 'POST',
        body: {
          kind: 'job-search',
          filters: {
            industry: industry?.length > 0 ? industry : undefined,
            location: location?.length > 0 ? location : undefined,
            salary: salary?.length > 0 ? salary : undefined,
            startDate: startDate || undefined,
            keyword: keyword || undefined
          }
        }
      });
      message.success('Job search preferences saved');
    } catch (e) {
      if (e.message?.includes('Not authenticated')) {
        message.warning('Sign in to save your search preferences');
      } else {
        message.error('Failed to save search preferences');
      }
    }
  };

  const jobs = jobsQuery.data?.data || [];
  const total = jobsQuery.data?.total || 0;
  const isLoading = jobsQuery.isLoading;

  return (
    <div style={{ padding: "0", minHeight: "80vh" }}>
      {/* Search Bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Text strong style={{ fontSize: "16px", marginBottom: "8px", display: "block" }}>
              Search by keyword
            </Text>
            <Input
              placeholder="Search job title, company name, or description"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              size="large"
              allowClear
              style={{ width: "100%" }}
            />
          </div>
        </Space>
      </Card>

      {/* Filter Bar */}
      <FilterBar
        filterConfig={getFilterConfig('job-search')}
        selectedFilters={filters}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAllFilters}
        onSaveProfile={handleSaveSearchProfile}
        showSaveProfile={true}
        showClearAll={true}
        theme={{
          activeColor: '#7d69ff',
          inactiveColor: '#f5f5f5',
          textColor: '#666',
          activeTextColor: '#fff'
        }}
      />

      {/* Results Section */}
      <div style={{ marginTop: 24, minHeight: "70vh", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            {isLoading ? "Loading..." : `${total} Jobs Found`}
          </Title>
          <Text type="secondary">
            Page {page} of {Math.ceil(total / 12)}
          </Text>
        </div>

        {isLoading ? (
          <div style={{ minHeight: "400px" }}>
            {[...Array(6)].map((_, i) => (
              <Card key={i} style={{ marginBottom: 16, height: "120px" }}>
                <Skeleton active />
              </Card>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "500px", width: "100%" }}>
            <div style={{ flex: 1, width: "100%" }}>
              <Row gutter={[16, 16]} style={{ width: "100%" }}>
                {jobs.map((job) => {
                  // Find existing application for this job
                  const ACTIVE_STATUSES = [1, 2, 3, 8, 4];
                  const existingApp = userApplications.find(app => 
                    String(app.jobListingId) === String(job._id) && 
                    ACTIVE_STATUSES.includes(app.status)
                  );
                  return (
                    <Col xs={24} key={job._id}>
                      <JobCard job={job} existingApplication={existingApp} />
                    </Col>
                  );
                })}
              </Row>
            </div>

            {/* Pagination */}
            {total > 12 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, paddingTop: "auto" }}>
                <Pagination
                  current={page}
                  pageSize={12}
                  total={total}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} jobs`}
                  onChange={(newPage) => setPage(newPage)}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "500px" }}>
            <Empty
              image={<Image src="/images/not_found.svg" alt="No jobs found" width={200} height={150} priority />}
              imageStyle={{ height: 150 }}
              description={
                <div>
                  <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>No jobs found</Text>
                  <Text type="secondary">Try adjusting your filters or search criteria</Text>
                </div>
              }
              style={{ margin: "48px 0" }}
            >
              <Button type="primary" onClick={handleClearAllFilters}>
                Clear Filters
              </Button>
            </Empty>
          </div>
        )}
      </div>
    </div>
  );
}
