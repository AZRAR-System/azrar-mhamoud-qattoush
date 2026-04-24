import os
import re

def check_imports():
    root_dir = r"g:\pk\pk\azrar-mhamoud-qattoush-recovered"
    src_dir = os.path.join(root_dir, "src")
    tests_dir = os.path.join(root_dir, "tests", "unit")
    
    files = [f for f in os.listdir(tests_dir) if f.endswith(".test.ts")]
    
    for f in files:
        path = os.path.join(tests_dir, f)
        with open(path, "r", encoding="utf-8") as file:
            content = file.read()
            # Match '@/...' or '../../src/...'
            imports = re.findall(r"from\s+['\"](@/|../../src/)([^'\"]+)['\"]", content)
            for prefix, module in imports:
                if prefix == "@/":
                    target = os.path.join(src_dir, module.replace("/", os.sep))
                else:
                    target = os.path.join(src_dir, module.replace("/", os.sep))
                
                # Check .ts, .tsx, or directory/index.ts
                possible_paths = [
                    target + ".ts",
                    target + ".tsx",
                    os.path.join(target, "index.ts"),
                    os.path.join(target, "index.tsx")
                ]
                
                found = False
                for p in possible_paths:
                    if os.path.exists(p):
                        found = True
                        break
                
                if not found:
                    print(f"BROKEN: {f} imports {prefix}{module} -> tried {possible_paths[0]}")

if __name__ == "__main__":
    check_imports()
