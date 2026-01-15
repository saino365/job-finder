#!/usr/bin/env python3
"""
Update Excel file with fix summaries for batch 7 defects (D91-D109)
"""

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

# File path
excel_file = 'JobFinder_TestCase.xlsx'
sheet_name = 'Defect'

# Row numbers and corresponding fix summaries
fixes = {
    # Job Creation
    'D91': 'Job creation missing fields: Fixed job creation form to include all required fields and ensure proper validation. Added validation for missing mandatory fields like title, description, location, and project details.',
    'D92': 'Job creation file upload: Fixed file upload functionality in job creation to properly handle document uploads including offer letters, onboarding materials, and other required documents. Added proper error handling and file type validation.',
    'D95': 'Job creation date validation: Added date validation to ensure start date is not in the past and end date is after start date. Validation works across all browsers and devices.',
    'D96': 'Job creation date fields: Fixed date picker fields in job creation form to properly save and display dates. Ensured dates are correctly formatted and stored in the database.',
    'D97': 'Job creation project details: Fixed project details section to properly save and display project title, description, start/end dates, locations, role description, and areas of interest.',
    'D99': 'Job creation location validation: Added validation to ensure location fields (city, state) are properly validated and saved. Fixed location display in job listings.',
    'D100': 'Job creation salary range: Fixed salary range input to properly validate and save min/max values. Added validation to ensure max is greater than or equal to min.',
    
    # Job Management
    'D93': 'Job publish functionality: Fixed job publish functionality to properly update status and send notifications. Added proper validation before publishing and error handling.',
    'D98': 'Job management date logic: Fixed date logic in job management to properly handle publish dates, expiry dates, and renewal dates. Ensured dates are correctly calculated and displayed.',
    'D101': 'Job management location validation: Fixed location validation in job edit form to ensure city and state are properly validated and saved. Improved location display in job details.',
    
    # Salary & Filters
    'D94': 'Salary validation: Fixed salary validation to ensure only numeric values are accepted and min/max ranges are valid. Added proper error messages for invalid salary inputs.',
    'D102': 'Location filter: Fixed location filter in job search to properly filter jobs by city and state. Improved filter UI and functionality.',
    'D103': 'Featured companies filter: Fixed featured companies filter to properly display and filter featured companies. Improved featured company badge and display logic.',
    'D104': 'Salary filter range: Fixed salary filter to properly handle salary ranges and display matching jobs. Improved filter logic for min/max salary matching.',
    
    # File Uploads (already fixed in batch 5, but verified)
    'D105': 'Resume file format validation: Verified and enhanced resume file format validation to reject image files and only allow PDF, DOC, DOCX, RTF formats with proper error messages.',
    'D106': 'Certificate file validation: Verified and enhanced certificate file validation to reject invalid file types like .xsl files and show proper error messages for unsupported formats.',
    
    # Application Management
    'D107': 'Application reject button: Fixed reject button functionality to properly reject applications with required reason. Added confirmation dialog and proper status update.',
    'D108': 'Application email notifications: Fixed email notification system to properly send notifications when application status changes. Notifications are sent for all status transitions.',
    
    # Session Management
    'D109': 'Browser close without logout: Fixed session management to properly handle browser close events. Added session cleanup and proper token invalidation on browser close.',
}

# Defect IDs to update
defect_ids = ['D91', 'D92', 'D93', 'D94', 'D95', 'D96', 'D97', 'D98', 'D99', 'D100', 
              'D101', 'D102', 'D103', 'D104', 'D105', 'D106', 'D107', 'D108', 'D109']

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
