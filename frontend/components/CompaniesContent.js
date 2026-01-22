"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Row, Col, Input, Typography, Pagination, Card, Skeleton, Empty, Space, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Image from "next/image";
import CompanyCard from "./CompanyCard";
import FilterBar from "./FilterBar";
import { getFilterConfig } from "./filterConfigs";
import { API_BASE_URL } from "../config";

const { Title, Text } = Typography;

export default function CompaniesContent() {
  // Search and filter states
  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [savedProfiles, setSavedProfiles] = useState([]);

  // Build query URL for companies
  const companiesUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("$limit", "12");
    params.set("verifiedStatus", "1"); // Only verified companies
    
    if (page > 1) {
      params.set("$skip", String((page - 1) * 12));
    }

    // Add keyword search
    if (keyword?.trim()) {
      params.set("keyword", keyword.trim());
    }

    // Add filter parameters (using job-search filter structure)
    const { industry, location, salary, startDate } = filters;

    // D175: Send all selected industries, not just the first one
    if (industry?.length > 0) {
      industry.forEach((ind, index) => {
        params.append("industry", ind); // Append all industries
      });
    }
    // D175: Send all selected locations, not just the first one
    if (location?.length > 0) {
      location.forEach((loc, index) => {
        params.append("city", loc); // Append all locations
      });
    }
    // Note: salary and startDate filters are not applicable for company search
    // but we keep the structure consistent with job-search filters

    // Sort by latest (default)
    params.set("$sort[createdAt]", "-1");

    // Add cache-busting parameter
    params.set("_t", Date.now().toString());

    return `${API_BASE_URL}/companies?${params.toString()}`;
  }, [keyword, filters, page]);

  // Fetch companies
  const companiesQuery = useQuery({
    queryKey: ["companies", companiesUrl],
    queryFn: async () => {
      console.log("🏢 Frontend: Fetching companies from:", companiesUrl);
      const response = await fetch(companiesUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("🏢 Frontend: Companies response:", data);
      return data;
    },
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
  });

  // Handle filter changes
  const handleFilterChange = (filterKey, values) => {
    console.log("🏢 Frontend: Filter change:", { filterKey, values });
    setFilters(prev => ({
      ...prev,
      [filterKey]: values
    }));
    setPage(1); // Reset to first page when filters change
  };

  // Handle clear all filters
  const handleClearAllFilters = () => {
    console.log("🏢 Frontend: Clearing all filters");
    setFilters({});
    setKeyword("");
    setPage(1);
  };

  // Handle save search profile
  const handleSaveSearchProfile = () => {
    const profile = {
      id: Date.now().toString(),
      name: `Company Search ${new Date().toLocaleDateString()}`,
      keyword,
      filters,
      createdAt: new Date().toISOString()
    };
    
    const newProfiles = [...savedProfiles, profile];
    setSavedProfiles(newProfiles);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('companySearchProfiles', JSON.stringify(newProfiles));
    }
    
    console.log("🏢 Frontend: Saved search profile:", profile);
  };

  const companies = companiesQuery.data?.data || [];
  const total = companiesQuery.data?.total || 0;
  const isLoading = companiesQuery.isLoading;

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
              placeholder="Search company name, industry, or description"
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
            {isLoading ? "Loading..." : `${total} Companies Found`}
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
        ) : companies.length > 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "500px", width: "100%" }}>
            <div style={{ flex: 1, minHeight: "450px", width: "100%" }}>
              <Row gutter={[16, 16]} style={{ minHeight: "450px", width: "100%" }}>
                {companies.map((company) => (
                  <Col xs={24} sm={12} md={12} lg={8} key={company._id}>
                    <CompanyCard company={company} />
                  </Col>
                ))}
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
                  showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} companies`}
                  onChange={(newPage) => setPage(newPage)}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "500px" }}>
            <Empty
              image={<Image src="/images/not_found.svg" alt="No companies found" width={200} height={150} priority />}
              imageStyle={{ height: 150 }}
              description={
                <div>
                  <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>No companies found</Text>
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
