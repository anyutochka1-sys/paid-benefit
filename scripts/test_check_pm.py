import json
from pathlib import Path
import unittest

from check_pm import DATA, PREFIX, compare_and_update, parse


class PmComparisonTests(unittest.TestCase):
    def setUp(self):
        self.target = json.loads(DATA.read_text(encoding='utf-8')[len(PREFIX):-2])
        self.source = {
            code: {'name': region['name'], 'act': region['act'],
                   'areas': {area[0]: tuple(area[1:]) for area in region['areas']}}
            for code, region in self.target['regions'].items()
        }

    def test_one_official_revision_changes_only_its_locality(self):
        old = self.target['regions']['24']['areas']
        self.source['24']['areas']['город Красноярск'] = (19892, 21681, 19294)
        changes = compare_and_update(self.source, self.target, '2026-09-29')
        self.assertEqual(len(changes), 1)
        self.assertEqual(next(row for row in old if row[0] == 'город Красноярск')[1:], [19892, 21681, 19294])
        self.assertEqual(self.target['retrieved'], '2026-09-29')

    def test_year_parser_rejects_mismatched_year(self):
        with self.assertRaises(ValueError):
            parse('<h1>Величина прожиточного минимума на 2027 год</h1>', 2026)

    def test_missing_locality_stops_update(self):
        del self.source['24']['areas']['город Красноярск']
        with self.assertRaisesRegex(ValueError, 'Состав местностей'):
            compare_and_update(self.source, self.target, '2026-09-29')


if __name__ == '__main__':
    unittest.main()
