#!/usr/bin/env python3
"""Compare the official SFR current-year table with the checked-in 2026 snapshot.

Only exact, already known region/locality keys can be updated automatically in
the proposed file. New years, missing rows, duplicate conflicts and schema
changes stop the workflow for manual review.
"""
import argparse
from datetime import date
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

DATA = Path(__file__).resolve().parents[1] / 'regional-pm-data.mjs'
PREFIX = '// Снимок официальной таблицы СФР на 29.09.2026. Порядок чисел: на душу населения, трудоспособные, дети.\nexport const regionalPm2026 = '
URL = 'https://sfr.gov.ru/grazhdanam/dop_info/prozhitochniy_min_deti/velichina_projitochnogo_minimuma_v_subektah_Rossiiskoi_Federacii_na_tekushchiy_god/'


class Table(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.row = None
        self.cell = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.depth += 1
        elif self.depth and tag == 'tr':
            self.row = []
        elif self.row is not None and tag in ('td', 'th'):
            self.cell = []

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)

    def handle_endtag(self, tag):
        if self.cell is not None and tag in ('td', 'th'):
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif self.row is not None and tag == 'tr':
            self.rows.append(self.row)
            self.row = None
        elif tag == 'table':
            self.depth -= 1


def number(value):
    if not re.fullmatch(r'[\d\s]+,\d{2}', value):
        raise ValueError(f'Неожиданная сумма ПМ: {value!r}')
    amount = float(value.replace(' ', '').replace(',', '.'))
    if not 5000 <= amount <= 100000:
        raise ValueError(f'ПМ вне контрольных границ: {amount}')
    return int(amount) if amount.is_integer() else amount


def parse(html, year=2026):
    heading = re.search(r'Величина прожиточного минимума[^<]{0,200}на (20\d\d) год', html)
    if not heading or int(heading.group(1)) != year:
        raise ValueError('Страница СФР уже не является таблицей 2026 года; нужен новый год и отдельная сверка')
    table = Table()
    table.feed(html)
    if len(table.rows) < 90 or not any('Субъект РФ (код)' in row for row in table.rows):
        raise ValueError('Заголовок или структура таблицы СФР изменились')
    regions = {}
    for row in table.rows:
        if len(row) not in (7, 8) or not re.fullmatch(r'\d+', row[0]):
            continue
        if row[:3] == ['1', '2', '4']:
            continue
        offset = 1 if len(row) == 8 else 0
        code = row[offset]
        if not re.fullmatch(r'\d{1,3}', code):
            continue
        name, amounts, act, area = row[offset + 1], tuple(map(number, row[offset + 2:offset + 5])), row[-2], row[-1]
        if not name or not area or not act:
            raise ValueError(f'Пустые данные в регионе {code}')
        region = regions.setdefault(code, {'name': name, 'act': act, 'areas': {}})
        if region['name'] != name:
            raise ValueError(f'Разные названия у кода {code}')
        old = region['areas'].get(area)
        if old is not None and old != amounts:
            raise ValueError(f'Противоречивые суммы: {code} / {area}')
        region['areas'][area] = amounts
    if len(regions) != 91:
        raise ValueError(f'Ожидали 91 субъект, получили {len(regions)}')
    return regions


def compare_and_update(source, target, today):
    if set(source) != set(target['regions']):
        raise ValueError('Состав субъектов изменился; требуется ручная сверка')
    changes = []
    for code, before in target['regions'].items():
        after = source[code]
        existing = {row[0]: row for row in before['areas']}
        if set(existing) != set(after['areas']):
            raise ValueError(f'Состав местностей изменился: {code} {before["name"]}')
        if before['name'] != after['name']:
            raise ValueError(f'Название региона изменилось: {code}')
        if ' '.join(before['act'].split()) != ' '.join(after['act'].split()):
            changes.append(f'{before["name"]}: изменился указанный СФР нормативный акт')
            before['act'] = after['act']
        for area, row in existing.items():
            if list(after['areas'][area]) != row[1:]:
                changes.append(f'{before["name"]}, {area}: {row[1:]} → {after["areas"][area]}')
                row[1:] = after['areas'][area]
    if changes:
        target['retrieved'] = today
    return changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--html', type=Path, help='Локальная копия страницы для проверки')
    parser.add_argument('--update', action='store_true', help='Подготовить обновлённый снимок для review')
    args = parser.parse_args()
    html = args.html.read_text(encoding='utf-8') if args.html else urlopen(Request(URL, headers={'User-Agent': 'BenefitPMMonitor/1.0'}), timeout=30).read().decode('utf-8')
    heading = re.search(r'Величина прожиточного минимума[^<]{0,200}на (20\d\d) год', html)
    if not heading:
        raise ValueError('Не найден год официальной таблицы СФР')
    year = int(heading.group(1))
    if not 2026 <= year <= date.today().year + 1:
        raise ValueError('Неожиданный год таблицы СФР')
    source = parse(html, year)
    if year != 2026:
        future_path = DATA.parent / 'regional-pm-future.mjs'
        future_prefix = '// Новые годы из официальной таблицы СФР. Изменения проходят проверку перед публикацией.\nexport const regionalPmFuture = '
        content = future_path.read_text(encoding='utf-8')
        if not content.startswith(future_prefix) or not content.endswith(';\n'):
            raise ValueError('Неизвестный формат новых годовых таблиц')
        years = json.loads(content[len(future_prefix):-2])
        key = str(year)
        if key in years:
            changes = compare_and_update(source, years[key], date.today().isoformat())
        else:
            previous = json.loads(DATA.read_text(encoding='utf-8')[len(PREFIX):-2])
            candidate = json.loads(json.dumps(previous))
            compare_and_update(source, candidate, date.today().isoformat())
            candidate.update(year=year, retrieved=date.today().isoformat(), source=URL)
            years[key] = candidate
            changes = [f'Новая полная официальная таблица ПМ на {year} год: требуется проверка']
        print('\n'.join(changes) if changes else 'Суммы ПМ нового года не изменились')
        if changes and args.update:
            future_path.write_text(future_prefix + json.dumps(years, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
        return
    content = DATA.read_text(encoding='utf-8')
    if not content.startswith(PREFIX) or not content.endswith(';\n'):
        raise ValueError('Формат файла с данными изменился')
    target = json.loads(content[len(PREFIX):-2])
    changes = compare_and_update(source, target, date.today().isoformat())
    print('\n'.join(changes) if changes else 'Суммы ПМ совпадают с таблицей СФР')
    if changes and args.update:
        DATA.write_text(PREFIX + json.dumps(target, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')


if __name__ == '__main__':
    main()
