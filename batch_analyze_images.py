#!/usr/bin/env python3
"""
Batch analyze extracted images and create a structured report.
Works with or without OCR - extracts metadata and organizes by sheet.
"""
import os
import sys
from pathlib import Path
from collections import defaultdict
import json
from datetime import datetime

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    print("Installing Pillow...")
    os.system(f"{sys.executable} -m pip install pillow --quiet")
    from PIL import Image
    HAS_PIL = True

# Try to import OCR (optional)
HAS_OCR = False
try:
    import pytesseract
    pytesseract.get_tesseract_version()
    HAS_OCR = True
except:
    pass

def extract_sheet_info(filename):
    """Extract sheet name and image number from filename."""
    # Format: SheetName_image_N.png
    if '_image_' in filename:
        parts = filename.split('_image_')
        sheet_name = parts[0]
        image_num = parts[1].split('.')[0] if len(parts) > 1 else '0'
        return sheet_name, int(image_num) if image_num.isdigit() else 0
    return 'Unknown', 0

def analyze_image(image_path):
    """Analyze a single image."""
    img_path = Path(image_path)
    if not img_path.exists():
        return None
    
    try:
        img = Image.open(img_path)
        width, height = img.size
        file_size = img_path.stat().st_size
        img_format = img.format
        img_mode = img.mode
        
        # Try OCR if available
        text = None
        text_lines = []
        if HAS_OCR:
            try:
                text = pytesseract.image_to_string(img, lang='eng')
                text_lines = [line.strip() for line in text.split('\n') if line.strip()]
            except:
                pass
        
        sheet_name, image_num = extract_sheet_info(img_path.name)
        
        return {
            'filename': img_path.name,
            'path': str(img_path),
            'sheet': sheet_name,
            'image_number': image_num,
            'width': width,
            'height': height,
            'size_bytes': file_size,
            'size_kb': round(file_size / 1024, 2),
            'format': img_format,
            'mode': img_mode,
            'text': text,
            'text_lines': text_lines,
            'has_text': len(text_lines) > 0,
            'text_preview': text[:200] if text else None
        }
    except Exception as e:
        return {
            'filename': img_path.name,
            'path': str(img_path),
            'error': str(e)
        }

def organize_by_sheet(images_dir="extracted_images"):
    """Organize all images by sheet and analyze them."""
    images_dir = Path(images_dir)
    if not images_dir.exists():
        print(f"Error: Directory not found: {images_dir}")
        return None
    
    # Find all image files
    image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    image_files = []
    for ext in image_extensions:
        image_files.extend(images_dir.glob(f'*{ext}'))
        image_files.extend(images_dir.glob(f'*{ext.upper()}'))
    
    image_files.sort()
    
    print(f"Found {len(image_files)} images")
    print("Analyzing images...")
    print("=" * 60)
    
    # Organize by sheet
    by_sheet = defaultdict(list)
    all_analyses = []
    
    for idx, img_file in enumerate(image_files, 1):
        if idx % 50 == 0:
            print(f"Progress: {idx}/{len(image_files)}...")
        
        analysis = analyze_image(img_file)
        if analysis:
            all_analyses.append(analysis)
            sheet_name = analysis.get('sheet', 'Unknown')
            by_sheet[sheet_name].append(analysis)
    
    # Sort images within each sheet by image number
    for sheet in by_sheet:
        by_sheet[sheet].sort(key=lambda x: x.get('image_number', 0))
    
    return {
        'by_sheet': dict(by_sheet),
        'all_images': all_analyses,
        'total': len(image_files),
        'sheets': list(by_sheet.keys())
    }

def generate_excel_summary_report(organized_data, output_file="image_analysis_summary.md"):
    """Generate a markdown summary report."""
    report_lines = [
        "# Image Analysis Summary",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        f"**Total Images:** {organized_data['total']}",
        f"**Sheets Found:** {len(organized_data['sheets'])}",
        "",
        "## Sheets Overview",
        ""
    ]
    
    for sheet_name in sorted(organized_data['sheets']):
        images = organized_data['by_sheet'][sheet_name]
        total_size = sum(img.get('size_bytes', 0) for img in images)
        with_text = sum(1 for img in images if img.get('has_text'))
        
        report_lines.extend([
            f"### {sheet_name}",
            f"- **Images:** {len(images)}",
            f"- **With Text (OCR):** {with_text}",
            f"- **Total Size:** {round(total_size / 1024 / 1024, 2)} MB",
            ""
        ])
    
    report_lines.extend([
        "## Detailed Image List",
        ""
    ])
    
    for sheet_name in sorted(organized_data['sheets']):
        images = organized_data['by_sheet'][sheet_name]
        report_lines.append(f"### {sheet_name} ({len(images)} images)")
        report_lines.append("")
        
        for img in images[:20]:  # Show first 20 per sheet
            report_lines.append(f"#### {img['filename']}")
            report_lines.append(f"- Dimensions: {img.get('width')}x{img.get('height')}")
            report_lines.append(f"- Size: {img.get('size_kb')} KB")
            if img.get('has_text'):
                preview = img.get('text_preview', '')
                if preview:
                    report_lines.append(f"- Text Preview: {preview[:100]}...")
            report_lines.append("")
        
        if len(images) > 20:
            report_lines.append(f"*... and {len(images) - 20} more images*")
            report_lines.append("")
    
    # Write report
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
    
    print(f"✅ Markdown report saved: {output_file}")
    return output_file

def generate_json_report(organized_data, output_file="image_analysis_detailed.json"):
    """Generate detailed JSON report."""
    report = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_images': organized_data['total'],
            'sheets': organized_data['sheets'],
            'sheet_counts': {sheet: len(images) for sheet, images in organized_data['by_sheet'].items()}
        },
        'by_sheet': {}
    }
    
    for sheet_name, images in organized_data['by_sheet'].items():
        report['by_sheet'][sheet_name] = {
            'count': len(images),
            'images': [
                {
                    'filename': img['filename'],
                    'image_number': img.get('image_number'),
                    'dimensions': f"{img.get('width')}x{img.get('height')}",
                    'size_kb': img.get('size_kb'),
                    'has_text': img.get('has_text'),
                    'text': img.get('text'),
                    'text_lines': img.get('text_lines', []),
                    'path': img.get('path')
                }
                for img in images
            ]
        }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"✅ JSON report saved: {output_file}")
    return output_file

def print_quick_summary(organized_data):
    """Print a quick summary to console."""
    print("\n" + "=" * 60)
    print("QUICK SUMMARY")
    print("=" * 60)
    print(f"\nTotal Images: {organized_data['total']}")
    print(f"Sheets: {len(organized_data['sheets'])}")
    print("\nImages per Sheet:")
    for sheet_name in sorted(organized_data['sheets']):
        count = len(organized_data['by_sheet'][sheet_name])
        print(f"  - {sheet_name}: {count} images")
    
    if HAS_OCR:
        print(f"\n✓ OCR enabled - text extraction available")
    else:
        print(f"\n⚠ OCR not available - install tesseract for text extraction:")
        print("  brew install tesseract  # macOS")
        print("  Then: pip install pytesseract")

if __name__ == "__main__":
    print("=" * 60)
    print("Batch Image Analyzer")
    print("=" * 60)
    
    if not HAS_OCR:
        print("\n⚠️  OCR (Tesseract) not installed - will analyze metadata only")
        print("   To enable text extraction: brew install tesseract")
        print("   Then: pip install pytesseract\n")
    
    # Analyze all images
    organized = organize_by_sheet()
    
    if organized:
        # Generate reports
        print("\n" + "=" * 60)
        print("Generating Reports...")
        print("=" * 60)
        
        generate_json_report(organized)
        generate_excel_summary_report(organized)
        print_quick_summary(organized)
        
        print("\n" + "=" * 60)
        print("✅ Analysis Complete!")
        print("=" * 60)
        print("\nReports generated:")
        print("  - image_analysis_detailed.json (full data)")
        print("  - image_analysis_summary.md (readable summary)")
        print("\nYou can now:")
        print("  1. Review the markdown summary")
        print("  2. Share specific images or sheet names for detailed analysis")
        print("  3. Ask me to focus on specific issues from the report")
