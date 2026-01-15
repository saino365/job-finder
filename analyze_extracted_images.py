#!/usr/bin/env python3
"""
Automatically analyze all extracted images from Excel file.
Extracts text using OCR and provides summaries.
"""
import os
import sys
from pathlib import Path
from collections import defaultdict
import json

try:
    from PIL import Image
    import pytesseract
except ImportError:
    print("Installing required packages...")
    os.system(f"{sys.executable} -m pip install pillow pytesseract --quiet")
    from PIL import Image
    import pytesseract

def analyze_image(image_path):
    """
    Analyze a single image and extract information.
    
    Returns:
        dict with analysis results
    """
    img_path = Path(image_path)
    if not img_path.exists():
        return None
    
    try:
        # Open image
        img = Image.open(img_path)
        width, height = img.size
        file_size = img_path.stat().st_size
        
        # Extract text using OCR
        try:
            text = pytesseract.image_to_string(img, lang='eng')
            text_lines = [line.strip() for line in text.split('\n') if line.strip()]
        except Exception as e:
            text_lines = []
            ocr_error = str(e)
        
        # Get image format and mode
        img_format = img.format
        img_mode = img.mode
        
        return {
            'path': str(img_path),
            'filename': img_path.name,
            'width': width,
            'height': height,
            'size_bytes': file_size,
            'format': img_format,
            'mode': img_mode,
            'text_lines': text_lines,
            'text': '\n'.join(text_lines),
            'has_text': len(text_lines) > 0
        }
    
    except Exception as e:
        return {
            'path': str(img_path),
            'filename': img_path.name,
            'error': str(e)
        }

def analyze_all_images(images_dir="extracted_images"):
    """
    Analyze all images in the extracted_images directory.
    """
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
    
    print(f"Found {len(image_files)} images to analyze...")
    print("=" * 60)
    
    results = []
    sheet_stats = defaultdict(lambda: {'count': 0, 'with_text': 0, 'total_size': 0})
    
    for idx, img_file in enumerate(image_files, 1):
        print(f"[{idx}/{len(image_files)}] Analyzing: {img_file.name}...", end=' ', flush=True)
        
        analysis = analyze_image(img_file)
        if analysis:
            results.append(analysis)
            
            # Extract sheet name from filename (format: SheetName_image_N.png)
            sheet_name = img_file.stem.split('_image_')[0] if '_image_' in img_file.stem else 'Unknown'
            sheet_stats[sheet_name]['count'] += 1
            sheet_stats[sheet_name]['total_size'] += analysis.get('size_bytes', 0)
            
            if analysis.get('has_text'):
                sheet_stats[sheet_name]['with_text'] += 1
                print(f"✓ (Text found: {len(analysis.get('text_lines', []))} lines)")
            else:
                print("✓")
        else:
            print("✗ Failed")
    
    return {
        'results': results,
        'stats': dict(sheet_stats),
        'total_images': len(image_files)
    }

def generate_report(analysis_data, output_file="image_analysis_report.json"):
    """
    Generate a detailed report from analysis.
    """
    report = {
        'summary': {
            'total_images': analysis_data['total_images'],
            'sheets': list(analysis_data['stats'].keys()),
            'sheet_statistics': analysis_data['stats']
        },
        'images_with_text': [],
        'images_without_text': [],
        'all_images': []
    }
    
    for img in analysis_data['results']:
        img_summary = {
            'filename': img.get('filename'),
            'sheet': img.get('filename', '').split('_image_')[0] if '_image_' in img.get('filename', '') else 'Unknown',
            'dimensions': f"{img.get('width')}x{img.get('height')}",
            'size_kb': round(img.get('size_bytes', 0) / 1024, 2),
            'has_text': img.get('has_text', False),
            'text_preview': img.get('text', '')[:200] if img.get('text') else None
        }
        
        report['all_images'].append(img_summary)
        
        if img.get('has_text'):
            report['images_with_text'].append({
                **img_summary,
                'text': img.get('text'),
                'text_lines': img.get('text_lines', [])
            })
        else:
            report['images_without_text'].append(img_summary)
    
    # Save JSON report
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Report saved to: {output_file}")
    return report

def print_summary(report):
    """
    Print a human-readable summary.
    """
    print("\n" + "=" * 60)
    print("IMAGE ANALYSIS SUMMARY")
    print("=" * 60)
    
    print(f"\nTotal Images Analyzed: {report['summary']['total_images']}")
    print(f"Images with Text: {len(report['images_with_text'])}")
    print(f"Images without Text: {len(report['images_without_text'])}")
    
    print("\n📊 By Sheet:")
    for sheet, stats in report['summary']['sheet_statistics'].items():
        print(f"  {sheet}:")
        print(f"    - Total images: {stats['count']}")
        print(f"    - With text: {stats['with_text']}")
        print(f"    - Total size: {round(stats['total_size'] / 1024 / 1024, 2)} MB")
    
    print("\n📝 Sample Images with Text:")
    for img in report['images_with_text'][:10]:  # Show first 10
        print(f"\n  {img['filename']} ({img['sheet']}):")
        text_preview = img.get('text', '')[:150]
        if text_preview:
            print(f"    Text: {text_preview}...")
    
    if len(report['images_with_text']) > 10:
        print(f"\n  ... and {len(report['images_with_text']) - 10} more images with text")

if __name__ == "__main__":
    print("=" * 60)
    print("Extracted Images Analyzer")
    print("=" * 60)
    print("\nThis will analyze all images in 'extracted_images/' directory")
    print("Using OCR to extract text and generate a report.\n")
    
    # Check if tesseract is installed
    try:
        pytesseract.get_tesseract_version()
    except Exception:
        print("⚠️  Tesseract OCR not found!")
        print("   Installing via Homebrew: brew install tesseract")
        print("   Or download from: https://github.com/tesseract-ocr/tesseract")
        print("\n   Continuing without OCR (will only get image metadata)...")
        # We'll continue but OCR won't work
    
    # Analyze images
    analysis = analyze_all_images()
    
    if analysis:
        # Generate report
        report = generate_report(analysis)
        
        # Print summary
        print_summary(report)
        
        print("\n" + "=" * 60)
        print("✅ Analysis complete!")
        print("=" * 60)
        print(f"\nFull report saved to: image_analysis_report.json")
        print("You can review the JSON file for detailed information about each image.")
