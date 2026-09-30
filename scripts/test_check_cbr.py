import unittest
from datetime import date
from check_cbr import parse_rates, month_ends

XML = '<ValCurs Date="30.08.2026"><Valute><CharCode>USD</CharCode><Nominal>1</Nominal><Value>80,0000</Value></Valute><Valute><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>90,0000</Value></Valute><Valute><CharCode>JPY</CharCode><Nominal>100</Nominal><Value>50,0000</Value></Valute></ValCurs>'

class CbrTests(unittest.TestCase):
    def test_weekend_and_nominal(self):
        result = parse_rates(XML, '2026-08-31')
        self.assertEqual(result['effectiveDate'], '2026-08-30')
        self.assertEqual(result['rates']['JPY']['rublesPerUnit'], 0.5)

    def test_future_or_stale_publication_rejected(self):
        for target in ['2026-08-29', '2026-09-30']:
            with self.assertRaises(ValueError):
                parse_rates(XML, target)

    def test_bad_rate_or_incomplete_feed_rejected(self):
        for xml in [XML.replace('50,0000', '-1'), XML.replace('USD', 'XXX'), XML.replace('100', '0'), '<html/>']:
            with self.assertRaises((ValueError, KeyError)):
                parse_rates(xml, '2026-08-31')

    def test_future_month_end_not_requested(self):
        ends = list(month_ends(date(2026, 9, 30)))
        self.assertEqual(ends[-1], '2026-08-31')
        self.assertIn('2024-02-29', ends)

if __name__ == '__main__':
    unittest.main()
