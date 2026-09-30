"""Download official month-end CBR rates; never request an unpublished future date."""
import calendar
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET

DATA = Path(__file__).resolve().parents[1] / 'data' / 'cbr-rates.json'
SOURCE = 'https://www.cbr.ru/scripts/XML_daily.asp'


def parse_rates(xml, requested):
    root = ET.fromstring(xml)
    if root.tag != 'ValCurs':
        raise ValueError('Unexpected CBR document')
    effective = date.fromisoformat('-'.join(reversed(root.attrib['Date'].split('.'))))
    requested_date = date.fromisoformat(requested)
    if not 0 <= (requested_date - effective).days <= 14:
        raise ValueError('CBR effective date does not match requested period')
    rates = {}
    for item in root.findall('Valute'):
        code = item.findtext('CharCode', '')
        nominal = Decimal(item.findtext('Nominal', '0'))
        value = Decimal(item.findtext('Value', '0').replace(',', '.'))
        if not re.fullmatch('[A-Z]{3}', code) or not nominal.is_finite() or not value.is_finite() or nominal <= 0 or value <= 0 or code in rates:
            raise ValueError('Invalid or duplicate CBR currency')
        rates[code] = {'nominal': int(nominal), 'value': float(value), 'rublesPerUnit': float(value / nominal)}
    if 'USD' not in rates or 'EUR' not in rates:
        raise ValueError('Incomplete CBR response')
    return {'effectiveDate': effective.isoformat(), 'source': SOURCE + '?date_req=' + requested_date.strftime('%d/%m/%Y'), 'rates': rates}


def month_ends(today):
    for year in range(2024, today.year + 1):
        for month in range(1, 13):
            target = date(year, month, calendar.monthrange(year, month)[1])
            if target < today:
                yield target.isoformat()


def fetch_rates(target):
    url = SOURCE + '?date_req=' + date.fromisoformat(target).strftime('%d/%m/%Y')
    request = urllib.request.Request(url, headers={'User-Agent': 'BenefitCalculator/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return target, parse_rates(response.read(), target)


def main():
    today = date.today()
    data = json.loads(DATA.read_text()) if DATA.exists() else {'source': SOURCE, 'dates': {}}
    dates = list(month_ends(today))
    # Refresh recent historical dates, and fill any missing older dates.
    targets = [d for d in dates if d not in data['dates'] or d in dates[-3:]]
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(fetch_rates, targets))
    for target, record in results:
        data['dates'][target] = record
    data['retrieved'] = today.isoformat()
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'CBR: {len(results)} dates fetched; {len(data["dates"])} dates stored')


if __name__ == '__main__':
    main()
