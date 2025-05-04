import os
import pathspec

# Define the ignore patterns (similar to .gitignore)
IGNORE_PATTERNS = """
# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# git
.git/
"""

def load_ignore_spec(base_dir):
    return pathspec.PathSpec.from_lines("gitwildmatch", IGNORE_PATTERNS.strip().splitlines())

def write_all_files_to_txt(root_dir, output_file_path):
    spec = load_ignore_spec(root_dir)
    with open(output_file_path, 'w', encoding='utf-8', errors='ignore') as outfile:
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(file_path, root_dir)

                # Skip the output file itself and ignored files
                if os.path.abspath(file_path) == os.path.abspath(output_file_path):
                    continue
                if spec.match_file(rel_path):
                    continue

                outfile.write(f"\n===== {rel_path} =====\n")
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                        content = infile.read()
                    outfile.write(content)
                except Exception as e:
                    outfile.write(f"[Could not read file: {e}]\n")

if __name__ == "__main__":
    project_directory = "./"  # 🔁 Set this to your project root
    output_file = "all_project_files.txt"
    write_all_files_to_txt(project_directory, output_file)
    print(f"✅ Done. Output written to '{output_file}'")
