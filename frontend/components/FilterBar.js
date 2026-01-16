import React, { useState, useEffect } from 'react';
import { Button, Dropdown, Card, Space, Typography, Checkbox, DatePicker, InputNumber, message, theme as antdTheme } from 'antd';

const FilterBar = ({
  filterConfig,
  selectedFilters,
  onFilterChange,
  onClearAll,
  onSaveProfile,
  showSaveProfile = false,
  showClearAll = true,
  theme = {
    activeColor: '#7d69ff',
    inactiveColor: '#f5f5f5',
    textColor: '#666',
    activeTextColor: '#fff'
  }
}) => {
  const { token } = antdTheme.useToken();
  const [openFilter, setOpenFilter] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // D191: Detect mobile/tab device
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = Object.values(selectedFilters).some(filter => 
    Array.isArray(filter) ? filter.length > 0 : filter
  );

  // Handle filter selection
  const handleFilterSelect = (filterKey, value, isChecked) => {
    console.log('🔧 FilterBar: Filter selected', { filterKey, value, isChecked });
    const currentValues = selectedFilters[filterKey] || [];
    let newValues;

    if (isChecked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter(v => v !== value);
    }

    console.log('🔧 FilterBar: Calling onFilterChange', { filterKey, newValues });
    onFilterChange(filterKey, newValues);
  };

  // Handle clear all filters
  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
      setOpenFilter(null);
      message.info('All filters cleared');
    }
  };

  // Render filter dropdown content
  const renderFilterContent = (filter) => {
    const { type, options, title } = filter;
    const filterKey = filter.key;
    const selectedValues = selectedFilters[filterKey] || [];

    switch (type) {
      case 'checkbox':
        return (
          <Card style={{
            width: 300,
            maxHeight: 400,
            overflow: 'auto',
            backgroundColor: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`
          }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong style={{ color: token.colorText }}>{title}</Typography.Text>
              {options.map(option => {
                const optionValue = typeof option === 'string' ? option : option.value;
                const optionLabel = typeof option === 'string' ? option : option.label;

                return (
                  <Checkbox
                    key={optionValue}
                    checked={selectedValues.includes(optionValue)}
                    onChange={(e) => handleFilterSelect(filterKey, optionValue, e.target.checked)}
                  >
                    <span style={{ color: token.colorText }}>{optionLabel}</span>
                  </Checkbox>
                );
              })}
            </Space>
          </Card>
        );

      case 'dateRange':
        return (
          <Card style={{
            width: 300,
            backgroundColor: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`
          }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong style={{ color: token.colorText }}>{title}</Typography.Text>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => {
                  onFilterChange(filterKey, dates);
                }}
                value={selectedValues}
              />
            </Space>
          </Card>
        );

      case 'numberRange':
        return (
          <Card style={{
            width: 300,
            backgroundColor: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`
          }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong style={{ color: token.colorText }}>{title}</Typography.Text>
              <Space>
                <InputNumber
                  placeholder="Min"
                  value={selectedValues[0]}
                  onChange={(value) => {
                    const newRange = [value, selectedValues[1]];
                    onFilterChange(filterKey, newRange);
                  }}
                />
                <span style={{ color: token.colorText }}>-</span>
                <InputNumber
                  placeholder="Max"
                  value={selectedValues[1]}
                  onChange={(value) => {
                    const newRange = [selectedValues[0], value];
                    onFilterChange(filterKey, newRange);
                  }}
                />
              </Space>
            </Space>
          </Card>
        );

      default:
        return null;
    }
  };

  // Render filter button
  const renderFilterButton = (filter) => {
    const { key, label, width = '120px' } = filter;
    const selectedValues = selectedFilters[key] || [];
    const isActive = Array.isArray(selectedValues) ? selectedValues.length > 0 : selectedValues;
    const count = Array.isArray(selectedValues) ? selectedValues.length : (selectedValues ? 1 : 0);
    // D191: Use responsive width for mobile
    const buttonWidth = isMobile ? 'auto' : width;
    const minButtonWidth = isMobile ? '80px' : width;

    return (
      <Dropdown
        key={key}
        open={openFilter === key}
        onOpenChange={(open) => setOpenFilter(open ? key : null)}
        trigger={['click']}
        popupRender={() => renderFilterContent(filter)}
      >
        <Button
          style={{
            borderRadius: '25px',
            backgroundColor: isActive ? theme.activeColor : token.colorBgLayout,
            color: isActive ? theme.activeTextColor : token.colorText,
            border: isActive ? `1px solid ${theme.activeColor}` : `1px solid ${token.colorBorder}`,
            fontWeight: '500',
            transition: 'all 0.3s ease',
            width: buttonWidth,
            minWidth: minButtonWidth,
            maxWidth: isMobile ? '100%' : width,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: isMobile ? 1 : 0,
            flexGrow: isMobile ? 1 : 0,
            overflow: 'hidden',
            padding: isMobile ? '4px 8px' : undefined
          }}
        >
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            justifyContent: 'center',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 1,
              fontSize: isMobile ? '12px' : undefined
            }}>
              {label}
            </span>
            {count > 0 && (
              <span style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '12px',
                minWidth: '20px',
                textAlign: 'center',
                flexShrink: 0
              }}>
                {count}
              </span>
            )}
            <span style={{ flexShrink: 0, fontSize: isMobile ? '10px' : undefined }}>▼</span>
          </span>
        </Button>
      </Dropdown>
    );
  };

  return (
    <div style={{
      background: token.colorBgContainer,
      padding: isMobile ? '12px' : '20px',
      borderRadius: '12px',
      marginBottom: '24px',
      border: `1px solid ${token.colorBorder}`,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '8px' : '12px', alignItems: 'center' }}>
        {/* Render filter buttons */}
        {filterConfig.map(filter => renderFilterButton(filter))}

        {/* Clear All Button */}
        {showClearAll && hasActiveFilters && (
          <Button
            onClick={handleClearAll}
            style={{
              borderRadius: '25px',
              backgroundColor: '#ff4d4f',
              color: '#fff',
              border: 'none',
              fontWeight: '500',
              marginLeft: 'auto'
            }}
          >
            Clear All
          </Button>
        )}

        {/* Save Profile Button */}
        {showSaveProfile && onSaveProfile && (
          <Button
            type="primary"
            onClick={onSaveProfile}
            style={{
              borderRadius: '25px',
              background: `linear-gradient(to right, ${theme.activeColor}, #917fff)`,
              border: 'none',
              fontWeight: '600',
              marginLeft: 'auto'
            }}
          >
            Save Profile
          </Button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
