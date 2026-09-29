import unittest

from openpyxl import Workbook

from check_rosstat import extract, merge_years


class AnnualRosstatChecks(unittest.TestCase):
    def test_preliminary_annual_column_stays_unconfirmed(self):
        book = Workbook()
        sheet = book.active
        sheet.append(["Регион", "2025", "2026 1)"])
        sheet.append(["Республика Мордовия", 66836.8, 73500])
        sheet.append(["1) Предварительные данные"])
        years, flagged = extract(book)
        self.assertEqual(years[2026]["Республика Мордовия"], 73500)
        self.assertEqual(flagged, {2026})

    def test_revision_revokes_confirmation_and_never_invents_publication_month(self):
        old = {"years": {"2026": {"regions": {"Республика Мордовия": 70000}, "preliminary": False,
                                 "final_confirmed": True, "publication_month": "2027-03", "first_seen": "2027-03-08"}}}
        regions = {f"Область {i} область": 60000 + i for i in range(80)}
        regions["Республика Мордовия"] = 73500
        updated, changes = merge_years(old, {2026: regions}, {2026}, {2026: "https://www.rosstat.gov.ru/file.xlsx"}, "2027-03-15")
        record = updated["years"]["2026"]
        self.assertTrue(changes)
        self.assertTrue(record["preliminary"])
        self.assertFalse(record["final_confirmed"])
        self.assertIsNone(record["publication_month"])
        self.assertEqual(record["first_seen"], "2027-03-08")
        again, changes = merge_years(updated, {2026: regions}, {2026}, {2026: "https://www.rosstat.gov.ru/file.xlsx"}, "2027-03-22")
        self.assertEqual(changes, [])
        self.assertEqual(again, updated)

    def test_short_table_is_rejected_before_update(self):
        with self.assertRaisesRegex(ValueError, "Only 1 regions"):
            merge_years({"years": {}}, {2026: {"Республика Мордовия": 70000}}, set(), {2026: "url"}, "2027-03-15")


if __name__ == "__main__":
    unittest.main()
