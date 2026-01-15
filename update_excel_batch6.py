#!/usr/bin/env python3
"""
Update Excel file with fix summaries for batch 6 defects (D36-D90)
"""

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

# File path
excel_file = 'JobFinder_TestCase.xlsx'
sheet_name = 'Defect'

# Row numbers and corresponding fix summaries
# Note: These are placeholder row numbers - adjust based on actual Excel file
fixes = {
    # UI/Layout
    'D36': 'Registration page mobile landscape layout: Added comprehensive CSS media queries for landscape orientation with reduced padding, font sizes, and form item margins. Added sessionStorage tracking for verification popup to prevent repeated displays.',
    
    # Validation
    'D42': 'Username field validation: Added async validation to check for duplicate usernames before form submission. Validation checks both alphabetic character count (min 3) and uniqueness via API call.',
    'D43': 'Name field validation: Enhanced name field validation to ensure proper format and prevent invalid characters. Added validation rules for firstName, middleName, and lastName fields.',
    'D44': 'Email/Username duplicate validation: Added async validation for both email and username fields in company registration to check for duplicates before submission, providing immediate feedback to users.',
    
    # Application Management
    'D39': 'Application status display: Fixed status display to correctly show employment status for hired applications (status 4) and application status for other states. Improved status tag rendering with proper color mapping.',
    'D76': 'Application status sync: Ensured application status updates are properly synced between candidate and company views. Added proper refresh logic after status changes.',
    'D77': 'Application notifications: Fixed notification system to properly send notifications when application status changes. Notifications are now sent for all status transitions including offer acceptance, rejection, and withdrawal.',
    'D78': 'Application status buttons: Fixed action buttons visibility and functionality based on application status. Buttons now correctly appear/disappear based on current state and user role.',
    'D83': 'Application validity extension: Fixed validity extension functionality to properly update validityUntil date and send notifications. Extension requests now properly update the application record.',
    'D84': 'Application status refresh: Fixed application list refresh after status changes. Added proper reload logic after accepting/declining offers and other status transitions.',
    
    # Company Features
    'D75': 'Company verification popup: Fixed verification in progress popup to only show once per session using sessionStorage. Popup no longer appears repeatedly on every page navigation.',
    'D79': 'Company employee management: Fixed employee management features including employee list display, details view, and status updates. Improved employee data fetching and display.',
    'D85': 'Company profile completeness: Enhanced profile completeness check to properly validate all required fields. Improved nag modal to only show when needed and respect user preferences.',
    
    # Profile
    'D80': 'Profile location field: Fixed location field in profile to properly save and display city, state, and country. Added proper validation and data handling for location data.',
    'D81': 'Profile completeness check: Fixed profile completeness calculation to include all required sections (Interest, Event, Location). Improved completeness percentage calculation and display.',
    
    # Job Management
    'D86': 'Job delete functionality: Fixed job deletion to properly remove job listings and handle related applications. Added proper confirmation dialogs and error handling.',
    'D87': 'Job cancel functionality: Fixed job cancellation to properly update status and handle related applications. Cancelled jobs are now properly marked and hidden from active listings.',
    'D88': 'Job data loss prevention: Added proper validation and confirmation dialogs to prevent accidental data loss when editing jobs. Form changes are now properly saved before navigation.',
    'D89': 'Job display issues: Fixed job listing display issues including proper date formatting, salary range display, and company information. Improved job card layout and information display.',
    'D90': 'Job status filter: Fixed job status filtering to properly filter jobs by status (active, closed, pending, etc.). Filter now correctly updates the job list based on selected status.',
    
    # Admin
    'D82': 'Admin company status filter: Fixed company management status filter to properly filter companies by verification status (pending, approved, rejected). Filter now correctly updates the company list based on selected status.',
}

# Defect IDs to update
defect_ids = ['D36', 'D42', 'D43', 'D44', 'D39', 'D76', 'D77', 'D78', 'D83', 'D84', 
              'D75', 'D79', 'D85', 'D80', 'D81', 'D86', 'D87', 'D88', 'D89', 'D90', 'D82']

def find_defect_row(ws, defect_id):
    """Find the row number for a given defect ID"""
    for row_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=ws.max_row, values_only=False), start=1):
        # Check first column (usually column A) for defect ID
        if row[0].value == defect_id:
            return row_idx
    return None

def update_excel():
    try:
        # Load workbook
        wb = load_workbook(excel_file)
        
        if sheet_name not in wb.sheetnames:
            print(f"Error: Sheet '{sheet_name}' not found in {excel_file}")
            return
        
        ws = wb[sheet_name]
        
        # Find Status and Fix Summary columns
        header_row = 1
        status_col = None
        fix_summary_col = None
        
        for col_idx, cell in enumerate(ws[header_row], start=1):
            if cell.value and 'Status' in str(cell.value):
                status_col = col_idx
            if cell.value and ('Fix Summary' in str(cell.value) or 'Fix' in str(cell.value)):
                fix_summary_col = col_idx
        
        if status_col is None or fix_summary_col is None:
            print("Error: Could not find 'Status' or 'Fix Summary' columns")
            print("Available columns:", [cell.value for cell in ws[header_row]])
            return
        
        print(f"Found Status column: {get_column_letter(status_col)}")
        print(f"Found Fix Summary column: {get_column_letter(fix_summary_col)}")
        
        updated_count = 0
        
        # Update each defect
        for defect_id in defect_ids:
            row_num = find_defect_row(ws, defect_id)
            
            if row_num:
                # Clear Status column
                ws.cell(row=row_num, column=status_col, value='')
                
                # Add Fix Summary
                fix_summary = fixes.get(defect_id, f'Fix applied for {defect_id}')
                ws.cell(row=row_num, column=fix_summary_col, value=fix_summary)
                
                print(f"✓ Updated {defect_id} at row {row_num}")
                updated_count += 1
            else:
                print(f"✗ Could not find {defect_id} in sheet")
        
        # Save workbook
        wb.save(excel_file)
        print(f"\n✓ Successfully updated {updated_count} defects in {excel_file}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    update_excel()
