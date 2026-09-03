"""Inspect locally generated test PDFs; never reads user/private inspiration data.

Run after the desk-packet Playwright test, using an isolated environment with
pymupdf installed. This verifies browser-produced PDFs, not a physical printer.
"""
import json
import os
import re
from pathlib import Path
import pymupdf

root = Path(__file__).resolve().parents[1]
evidence = Path(os.environ.get("BENCHKEEPER_TEST_EVIDENCE_DIR", str(root / "work" / "evidence"))).resolve()
assert evidence.is_relative_to(root / "work"), "PDF evidence must stay inside project work"
assert evidence.relative_to(root / "work").parts[0] != "private", "Private material is not PDF evidence"
reports = []
for name in ("current-desk-packet", "stale-desk-packet"):
    document = pymupdf.open(evidence / f"{name}.pdf")
    texts = [page.get_text() for page in document]
    normalized = [" ".join(text.split()) for text in texts]
    reports.append({"file": f"{name}.pdf", "pages": len(document),
                    "pageTextCharacters": [len(text) for text in texts]})
    if name == "current-desk-packet":
        assert len(document) == 5, "Expected reception plus four repairer sheets"
        assert "9 appointments" in texts[0]
        assert "PROTECTED" in texts[1]
        assert any("Reserved: Walk-in reserve" in text for text in normalized)
        assert any("Held for walk-ins. Not bookable by the planner." in text for text in normalized)
        for index in (0, 1, 4):
            document[index].get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(
                evidence / f"packet-page-{index + 1}.png")
    else:
        assert len(document) == 1
        assert "Packet out of date" in texts[0]
        assert "Desk lamp" not in texts[0]
(evidence / "packet-pdf-check.json").write_text(json.dumps(reports, indent=2) + "\n")
print(json.dumps(reports))

maximum_path = evidence / "maximum-desk-packet.pdf"
if maximum_path.exists():
    document = pymupdf.open(maximum_path)
    text = " ".join(" ".join(page.get_text().split()) for page in document)
    assert 9 <= len(document) <= 20, "Expected reception plus eight possibly paginated repairer sheets"
    ids = re.findall(r"\brequest-(\d+)\b", text)
    assert sorted(map(int, ids)) == list(range(24)), "All 24 item IDs must print exactly once"
    for index in range(24):
        assert f"Endnote {index}." in text, f"Note {index} was clipped"
    for index in range(len(document)):
        assert len(document[index].get_text().strip()) > 20, f"Unexpected blank page {index + 1}"
    for index in (1, 2):
        document[index].get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(evidence / f"maximum-packet-page-{index + 1}.png")
    result = {"file": maximum_path.name, "pages": len(document), "uniqueItemIds": len(ids), "completeNotes": 24}
    (evidence / "maximum-packet-check.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
