#!/usr/bin/env python3
"""
Create a checklist/worklist from the analyzed images to track fixes.
"""
import json
from pathlib import Path
from datetime import datetime

def create_checklist():
    """Create a markdown checklist from the analysis."""
    
    # Load the detailed analysis
    with open('image_analysis_detailed.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    checklist_lines = [
        "# Fix Checklist - Job Finder Test Cases",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## How to Use",
        "- [ ] Mark items as complete when fixed",
        "- Paste images in chat for detailed analysis",
        "- Focus on one sheet at a time",
        "",
        "---",
        ""
    ]
    
    # Create checklist for each sheet
    for sheet_name in sorted(data['by_sheet'].keys()):
        images = data['by_sheet'][sheet_name]['images']
        
        checklist_lines.extend([
            f"## {sheet_name} ({len(images)} items)",
            ""
        ])
        
        for img in images:
            img_num = img.get('image_number', 0)
            filename = img['filename']
            dimensions = img.get('dimensions', 'N/A')
            
            checklist_lines.append(
                f"- [ ] **{filename}** ({dimensions}) - *Image #{img_num}*"
            )
        
        checklist_lines.append("")
        checklist_lines.append("---")
        checklist_lines.append("")
    
    # Write checklist
    output_file = "FIX_CHECKLIST.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(checklist_lines))
    
    print(f"✅ Checklist created: {output_file}")
    print(f"\nTotal items to review: {data['summary']['total_images']}")
    
    return output_file

if __name__ == "__main__":
    if not Path('image_analysis_detailed.json').exists():
        print("Error: image_analysis_detailed.json not found.")
        print("Please run batch_analyze_images.py first.")
    else:
        create_checklist()
