// All detail strings are plain text, including user-entered child labels.
export function escapeText(value) {
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
export function monthLabel(value,capitalize=false) {
  const match=/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(value??'');
  if(!match)return String(value??'');
  const text=months[Number(match[2])-1]+' '+match[1];return capitalize?text[0].toUpperCase()+text.slice(1):text;
}
export function dateLabel(value) {
  const match=/^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/.exec(value??'');
  if(!match)return String(value??'');
  return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
}
export function resultCard(date,window,label,detail,tone,open) {
  const readable=value=>String(value??'').replace(/\b\d{4}-(?:0[1-9]|1[0-2])-\d{2}\b/g,dateLabel).replace(/\b\d{4}-(?:0[1-9]|1[0-2])\b/g,value=>monthLabel(value));
  const detailHtml=Array.isArray(detail)?detail.filter(block=>block.text?.trim()).map(block=>`<section class="result-section"><h3>${escapeText(block.title)}</h3><p>${escapeText(readable(block.text))}</p></section>`).join(''):escapeText(readable(detail));
  const safeTone=['bad','ok','unknown'].includes(tone)?tone:'unknown';
  return `<details class="result"${open?' open':''}><summary><span class="result-date">${escapeText(monthLabel(date,true))}<small>Подача: ${escapeText(dateLabel(date))}</small><small>Доходы: ${escapeText(monthLabel(window[0]))} — ${escapeText(monthLabel(window.at(-1)))}</small></span><span class="${safeTone}">${escapeText(label)}</span></summary><div class="result-detail">${detailHtml}</div></details>`;
}
export function childLabel(child,index) {
  const name=child.name?.trim();
  return name?`Ребёнок ${index+1} (${name})`:`Ребёнок ${index+1}`;
}
