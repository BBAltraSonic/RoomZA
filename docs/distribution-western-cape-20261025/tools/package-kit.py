from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
asset_checks = json.loads((root / 'verification/asset-checks.json').read_text(encoding='utf-8'))
workbook_checks = json.loads((root / 'verification/workbook-checks.json').read_text(encoding='utf-8'))
browser_checks = json.loads((root / 'verification/browser-checks.json').read_text(encoding='utf-8'))
assert 'MP4 playback advances and seeks into the second scene' in browser_checks['checks']
assert 'Clipboard fallback preserves the shorter TikTok caption' in browser_checks['checks']
assert not browser_checks['errors'] and not browser_checks['failures']
assert len(workbook_checks['tests']) >= 23
report = f'''# Verification and continuation checkpoint

Prepared 25 October 2026. This is the local launch kit, not a report of a launched campaign.

## Completed

- Eight 24-second H.264 MP4s at 1080 x 1920 with silent AAC audio; individual caption, optional voiceover and SRT files.
- Four six-slide carousels at 1080 x 1350, plus matching copy, SVG sources, a profile image and a Facebook cover.
- Thirty-day calendar starting 26 October. Every production week contains two videos and one carousel.
- Nine sourced provider prospects and eight community candidates, with explicit source/access limits. No candidate is recorded as a participant.
- Four-tab operational workbook. {len(workbook_checks['tests'])} formula scenarios passed, including duplicate owners/enquiries, test exclusion, first/final date boundaries, unknown paid attribution, readiness evidence and spending limits. Final formula scan found no errors. All temporary fixture inputs were cleared before export.
- Browser checks passed: {len(browser_checks['checks'])} checks covering filters, caption copy, all 40 local document/download links, video metadata/playback and the 390px layout. The browser rendered the kit in desktop and mobile-sized viewports.
- All 56 video scene/carousel images were reviewed in a contact sheet. All four workbook tabs were rendered and visually reviewed.

## Boundaries

No app build, deployment or database changes were needed. Native Excel editing was not exercised; workbook calculations were tested in Artifact Tool and exported to XLSX. Mobile browser dimensions are not a real-device test. None of these local checks establishes working live listing discovery, authenticated owner submission, contact delivery, area-alert delivery or production attribution.

Accounts are to be created by the user. Metricool became available in this session; its brand check returned no connected social networks. Nothing has been posted, scheduled or sent to an owner/group administrator. No advertising campaign was created and advertising spend remains R0.

## Resume when the accounts exist

1. Obtain the three public profile links and business email. Apply the supplied profile image, cover and bio.
2. Connect the intended profiles at https://app.metricool.com/brands/connections?blogId=7648174 and read the resulting connection state before scheduling.
3. If Day 1 moves, update Calendar C4 in the workbook. Use that as the operative calendar; update calendar.csv/calendar.md too if using them to schedule. Campaign dates are proposals, not live scheduling records.
4. Schedule only the next week of preparation assets. V01, V02 and C01 are the opening set. Use the correct local timezone and current promotional-content disclosures.
5. Check the prospect/community shortlist and invite suitable owners individually using the supplied drafts. Keep original permissions separately and record neutral evidence references.
6. Substitute a genuine walkthrough only after current facts, organic rights, normal listing publication and a tested share link exist. Use V05 if these inputs are absent.
7. Complete the live readiness evidence before any browse/submit CTA or paid launch. Keep every open check visible. Use the first R375 tranche only after the gates pass; do not activate a R750 continuous campaign that bypasses the review.
'''
(root / 'verification.md').write_text(report, encoding='utf-8')
allowed_files = [
    'README.md', 'index.html', 'campaign.json', 'calendar.json', 'calendar.csv', 'calendar.md',
    'content-library.md', 'profiles-and-publishing.md', 'owner-outreach-and-ugc.md',
    'community-posts.md', 'readiness-and-measurement.md', 'research-shortlist.csv', 'verification.md',
    'outputs/pinpoint-western-cape-20261025/Pinpoint-Western-Cape-Tracker.xlsx'
]
files = [root / item for item in allowed_files]
files.extend(p for p in (root / 'assets').rglob('*') if p.is_file())
files.extend((root / 'tools').glob('*.mjs'))
files.append(root / 'tools/package-kit.py')
destination = root / 'Pinpoint-Western-Cape-Launch-Kit.zip'
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(root).as_posix())
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert 'index.html' in archive.namelist()
    assert len([n for n in archive.namelist() if n.endswith('.mp4')]) == 8
    assert len([n for n in archive.namelist() if '/slide-' in n and n.endswith('.png')]) == 24
    assert not any('node_modules' in n or '.build' in n for n in archive.namelist())
    count = len(archive.namelist())
print(json.dumps({'archive': str(destination), 'files': count, 'bytes': destination.stat().st_size}))
