#!/usr/bin/env python3
"""
Stranded File Finder
Systematically checks all files in the repository to identify unused/orphaned files.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

# Files and directories to skip
SKIP_DIRS = {
    '.git', 'node_modules', '__pycache__', '.cache',
    'supersplat-build', 'venv', 'env', '.vscode', '.idea'
}

SKIP_FILES = {
    '.DS_Store', '.gitignore', '.envrc', 'package-lock.json',
    'find_stranded_files.py'  # Don't check this script itself
}

# Extensions that are typically referenced
REFERENCEABLE_EXTENSIONS = {
    '.js', '.css', '.json', '.geojson', '.png', '.jpg', '.jpeg',
    '.gif', '.svg', '.webp', '.ico', '.ply', '.glb', '.bin',
    '.csv', '.tsv', '.txt', '.md', '.html', '.py', '.sh',
    '.npy', '.pkl'
}

# Extensions to search within for references
SEARCHABLE_EXTENSIONS = {
    '.js', '.py', '.html', '.css', '.json', '.md', '.sh', '.txt'
}

# Always keep these files (essential)
ALWAYS_KEEP = {
    'README.md', 'LICENSE', 'package.json', '.gitignore',
    'server.py', 'index.html', 'CLAUDE.md', 'CLOUD_CONFIG.md',
    'PLY_DEPLOYMENT_GUIDE.md', 'favicon.ico', '.envrc.template'
}

class StrandedFileFinder:
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.all_files = []
        self.searchable_content = {}
        self.references = defaultdict(set)
        self.potentially_stranded = []

    def collect_all_files(self):
        """Collect all files in the repository"""
        print("📁 Collecting all files...")
        for root, dirs, files in os.walk(self.root_dir):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            root_path = Path(root)
            for file in files:
                if file in SKIP_FILES:
                    continue

                file_path = root_path / file
                rel_path = file_path.relative_to(self.root_dir)
                self.all_files.append(rel_path)

        print(f"   Found {len(self.all_files)} files to analyze\n")

    def load_searchable_content(self):
        """Load content of searchable files"""
        print("📖 Loading searchable file content...")
        count = 0
        for file_path in self.all_files:
            if file_path.suffix in SEARCHABLE_EXTENSIONS:
                try:
                    full_path = self.root_dir / file_path
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                        self.searchable_content[file_path] = f.read()
                    count += 1
                except Exception as e:
                    print(f"   ⚠️  Error reading {file_path}: {e}")

        print(f"   Loaded {count} searchable files\n")

    def find_references(self):
        """Search for references to each file"""
        print("🔍 Searching for file references...")
        total = len(self.all_files)

        for idx, file_path in enumerate(self.all_files, 1):
            if idx % 10 == 0 or idx == total:
                print(f"   Progress: {idx}/{total} files checked", end='\r')

            # Skip if extension not referenceable
            if file_path.suffix not in REFERENCEABLE_EXTENSIONS:
                continue

            # Get various forms of the filename that might be referenced
            filename = file_path.name
            stem = file_path.stem
            rel_str = str(file_path)
            posix_path = file_path.as_posix()

            # Also check without extension for some files
            patterns = [
                filename,
                stem,
                rel_str,
                posix_path,
                rel_str.replace('\\', '/'),
            ]

            # For data files, check if directory is referenced
            if 'data/' in posix_path:
                parts = posix_path.split('/')
                if len(parts) >= 2:
                    patterns.append('/'.join(parts[-2:]))  # last dir + filename

            # Search for these patterns in searchable content
            for search_file, content in self.searchable_content.items():
                if search_file == file_path:
                    continue  # Don't count self-references

                for pattern in patterns:
                    if pattern in content:
                        self.references[file_path].add(search_file)
                        break

        print(f"\n   Completed reference search\n")

    def identify_stranded_files(self):
        """Identify files with no references"""
        print("🎯 Identifying potentially stranded files...\n")

        for file_path in self.all_files:
            # Always keep essential files
            if file_path.name in ALWAYS_KEEP:
                continue

            # Skip non-referenceable files
            if file_path.suffix not in REFERENCEABLE_EXTENSIONS:
                continue

            # Check if file has no references
            if not self.references.get(file_path):
                self.potentially_stranded.append(file_path)

        print(f"   Found {len(self.potentially_stranded)} potentially stranded files\n")

    def generate_report(self):
        """Generate final report"""
        print("=" * 80)
        print("STRANDED FILE REPORT")
        print("=" * 80)
        print()

        if not self.potentially_stranded:
            print("✅ No stranded files found! Repository is clean.")
            return

        # Group by directory
        by_dir = defaultdict(list)
        for file_path in sorted(self.potentially_stranded):
            dir_name = str(file_path.parent) if file_path.parent != Path('.') else 'root'
            by_dir[dir_name].append(file_path)

        print(f"Found {len(self.potentially_stranded)} potentially stranded files:\n")

        for dir_name in sorted(by_dir.keys()):
            files = by_dir[dir_name]
            print(f"📂 {dir_name}/ ({len(files)} files)")
            for file_path in sorted(files):
                size = (self.root_dir / file_path).stat().st_size
                size_str = self._format_size(size)
                print(f"   • {file_path.name} ({size_str})")
            print()

        # Summary
        total_size = sum((self.root_dir / f).stat().st_size for f in self.potentially_stranded)
        print("=" * 80)
        print(f"SUMMARY: {len(self.potentially_stranded)} files, {self._format_size(total_size)} total")
        print("=" * 80)
        print()
        print("⚠️  IMPORTANT: Manual verification recommended before deletion!")
        print("   Some files may be:")
        print("   - Used by external tools or deployment scripts")
        print("   - Referenced via dynamic paths not detected by static analysis")
        print("   - Documentation or reference files intentionally kept")
        print()

        # Save detailed report to file
        report_file = self.root_dir / 'stranded_files_report.txt'
        with open(report_file, 'w') as f:
            f.write("STRANDED FILE REPORT\n")
            f.write("=" * 80 + "\n\n")
            for file_path in sorted(self.potentially_stranded):
                size = (self.root_dir / file_path).stat().st_size
                f.write(f"{file_path}\t{size} bytes\n")

        print(f"📄 Detailed report saved to: {report_file.name}\n")

    def _format_size(self, size):
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f}{unit}"
            size /= 1024
        return f"{size:.1f}TB"

    def run(self):
        """Run the complete analysis"""
        print("\n🔎 STRANDED FILE FINDER")
        print("=" * 80)
        print()

        self.collect_all_files()
        self.load_searchable_content()
        self.find_references()
        self.identify_stranded_files()
        self.generate_report()

if __name__ == '__main__':
    finder = StrandedFileFinder('/Users/lancelegel/terrain-3d-fresh')
    finder.run()
