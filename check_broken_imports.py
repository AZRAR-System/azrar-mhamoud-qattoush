import os
import re

def check_imports():
    root = "."
    src_dir = os.path.normpath(os.path.join(root, "src"))
    
    broken = []
    
    for dirpath, _, filenames in os.walk(root):
        if "node_modules" in dirpath:
            continue
        if ".git" in dirpath:
            continue
            
        for f in filenames:
            if f.endswith(".test.ts") or (f.endswith(".ts") and not f.endswith(".d.ts")):
                path = os.path.join(dirpath, f)
                with open(path, "r", encoding="utf-8") as file:
                    try:
                        content = file.read()
                    except:
                        continue
                        
                    # 1. Find all @/ imports
                    alias_imports = re.findall(r"from\s+['\"]@/([^'\"]+)['\"]", content)
                    for imp in alias_imports:
                        target = os.path.normpath(os.path.join(src_dir, imp))
                        if not (os.path.exists(target + ".ts") or 
                                os.path.exists(target + ".tsx") or 
                                os.path.exists(os.path.join(target, "index.ts")) or
                                os.path.exists(os.path.join(target, "index.tsx"))):
                            broken.append((path, f"@/{imp}"))
                            
                    # 2. Find all relative imports
                    rel_imports = re.findall(r"from\s+['\"](\.[^'\"]+)['\"]", content)
                    for imp in rel_imports:
                        target = os.path.normpath(os.path.join(dirpath, imp))
                        if not (os.path.exists(target + ".ts") or 
                                os.path.exists(target + ".tsx") or 
                                os.path.exists(os.path.join(target, "index.ts")) or
                                os.path.exists(os.path.join(target, "index.tsx"))):
                            broken.append((path, imp))
                            
    return broken

if __name__ == "__main__":
    results = check_imports()
    if not results:
        print("No broken imports found.")
    for p, imp in results:
        print(f"File: {p} -> Missing: {imp}")
