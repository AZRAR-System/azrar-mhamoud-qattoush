import os
import re

def check_imports():
    root_dir = r"g:\pk\pk\azrar-mhamoud-qattoush-recovered"
    src_dir = os.path.join(root_dir, "src")
    tests_dir = os.path.join(root_dir, "tests")
    
    for root, dirs, files in os.walk(tests_dir):
        for f in files:
            if not f.endswith(".test.ts"):
                continue
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, tests_dir)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
                # Find all imports
                imports = re.findall(r"from\s+['\"]([^'\"]+)['\"]", content)
                for module in imports:
                    if module.startswith("@/"):
                        target = os.path.join(src_dir, module[2:].replace("/", os.sep))
                    elif module.startswith("."):
                        # Relative to the test file
                        target = os.path.join(root, module.replace("/", os.sep))
                    else:
                        # Probably a node_module
                        continue
                    
                    # If it's a relative import to src, we need to handle it
                    if "../../src/" in module:
                        # This was handled by the logic above if we treat it as relative to root
                        pass
                        
                    # Possible extensions
                    possible_paths = [
                        target + ".ts",
                        target + ".tsx",
                        target + ".js",
                        os.path.join(target, "index.ts"),
                        os.path.join(target, "index.tsx")
                    ]
                    
                    found = False
                    for p in possible_paths:
                        if os.path.exists(p):
                            found = True
                            break
                    
                    if not found:
                        # Special check for ../../src/ in relative module
                        if "../../src/" in module:
                             # Resolve relative to file
                             abs_module = os.path.normpath(os.path.join(root, module.replace("/", os.sep)))
                             for ext in [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]:
                                 if os.path.exists(abs_module + ext):
                                     found = True
                                     break
                                 if ext.startswith("/") and os.path.exists(os.path.join(abs_module, ext[1:])):
                                     found = True
                                     break

                    if not found:
                        print(f"BROKEN: {rel_path} imports {module}")

if __name__ == "__main__":
    check_imports()
