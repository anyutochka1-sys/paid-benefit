// All detail strings are plain text, including user-entered child labels.
export function escapeText(value) {
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
export function resultCard(date,window,label,detail,tone,open) {
  const detailHtml=Array.isArray(detail)?detail.filter(block=>block.text?.trim()).map(block=>`<section class="result-section"><h3>${escapeText(block.title)}</h3><p>${escapeText(block.text)}</p></section>`).join(''):escapeText(detail);
  const safeTone=['bad','ok','unknown'].includes(tone)?tone:'unknown';
  return `<details class="result"${open?' open':''}><summary><span class="result-date">${escapeText(date)}<small>Доходы: ${escapeText(window[0])} — ${escapeText(window.at(-1))}</small></span><span class="${safeTone}">${escapeText(label)}</span></summary><div class="result-detail">${detailHtml}</div></details>`;
}
export function childLabel(child,index) {
  const name=child.name?.trim();
  return name?`Ребёнок ${index+1} (${name})`:`Ребёнок ${index+1}`;
}
