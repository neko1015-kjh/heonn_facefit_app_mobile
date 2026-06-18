# 웹 배포용 빌드 스크립트
#
# 한 번 실행하면 아래를 자동으로 처리합니다:
#  1) expo export (웹 정적 파일 dist 생성)
#  2) 글꼴 폴더 이름 변경 (node_modules → vendorfonts)
#     - Netlify가 node_modules 폴더를 무시하는 문제 회피
#  3) 번들 안의 글꼴 경로 문자열도 함께 변경
#  4) 유닉스식 경로(/)로 site.zip 압축
#     - 윈도우식 경로(\)면 Netlify가 폴더 구조를 못 풀어 글꼴이 깨짐
#
# 사용법(프로젝트 폴더에서):  python scripts/build_web.py
# 만들어진 site.zip 을 https://app.netlify.com/drop 에 끌어다 놓으면 배포됩니다.

import os
import shutil
import zipfile
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(ROOT, "site.zip")

print("1) expo export 실행 중… (몇 분 걸립니다)")
subprocess.run("npx expo export --platform web", cwd=ROOT, shell=True, check=True)

print("2) 글꼴 폴더 이름 변경 (node_modules → vendorfonts)")
nm = os.path.join(DIST, "assets", "node_modules")
vf = os.path.join(DIST, "assets", "vendorfonts")
if os.path.exists(nm):
    if os.path.exists(vf):
        shutil.rmtree(vf)
    shutil.move(nm, vf)

print("3) 번들 내 글꼴 경로 문자열 치환")
changed = 0
for root, _, files in os.walk(DIST):
    for fn in files:
        if fn.endswith((".js", ".html", ".json")):
            p = os.path.join(root, fn)
            with open(p, "r", encoding="utf-8") as f:
                c = f.read()
            if "assets/node_modules" in c:
                with open(p, "w", encoding="utf-8") as f:
                    f.write(c.replace("assets/node_modules", "assets/vendorfonts"))
                changed += 1
print(f"   치환된 파일 수: {changed}")

print("4) 유닉스 경로(/)로 site.zip 압축")
if os.path.exists(OUT):
    os.remove(OUT)
count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(DIST):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, DIST).replace(os.sep, "/")
            z.write(full, rel)
            count += 1

print(f"\n완료! site.zip 생성 ({count}개 파일, {round(os.path.getsize(OUT)/1024/1024, 1)}MB)")
print("→ https://app.netlify.com/drop 에 site.zip 을 끌어다 놓으세요.")
