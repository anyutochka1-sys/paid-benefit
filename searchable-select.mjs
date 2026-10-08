const controls=new WeakMap();let nextId=0;
const normalize=s=>String(s).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
export function searchableSelect(select,{label,placeholder='Начните вводить или выберите из списка'}={}){
  if(controls.has(select)){controls.get(select).sync();return controls.get(select)}
  const doc=select.ownerDocument,win=doc.defaultView,wrap=doc.createElement('div');wrap.className='search-select';
  select.after(wrap);select.classList.add('search-select-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const input=doc.createElement('input');input.type='text';input.autocomplete='off';input.placeholder=placeholder;input.className='search-select-input';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-label',label||select.labels?.[0]?.textContent.trim()||'Выберите');
  const list=doc.createElement('div');list.id='search-options-'+(++nextId);list.className='search-select-options';list.setAttribute('role','listbox');list.hidden=true;input.setAttribute('aria-controls',list.id);
  const toggle=doc.createElement('button');toggle.type='button';toggle.className='search-select-toggle';toggle.textContent='⌄';toggle.setAttribute('aria-label','Показать список: '+(label||'варианты'));toggle.setAttribute('aria-expanded','false');
  const status=doc.createElement('span');status.className='search-select-status';status.setAttribute('aria-live','polite');wrap.append(input,toggle,list,status);
  const details=doc.createElement('details');details.className='search-select-details';details.hidden=true;const summary=doc.createElement('summary');summary.textContent='Состав территории и источник';const composition=doc.createElement('p');const source=doc.createElement('a');source.target='_blank';source.rel='noopener';details.append(summary,composition,source);wrap.after(details);
  let active=-1,items=[],buttons=[],open=false,editing=false;
  function sync(){const option=select.selectedOptions[0];details.hidden=!option?.dataset.composition;composition.textContent=option?.dataset.composition||'';source.textContent=option?.dataset.act||'Официальный источник';source.href=option?.dataset.source||'';if(editing&&open)return;input.value=select.selectedOptions[0]?.value?select.selectedOptions[0].textContent:'';}
  function close(){open=false;editing=false;list.hidden=true;input.setAttribute('aria-expanded','false');toggle.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');status.textContent='';sync();}
  function choose(option){select.value=option.value;close();select.dispatchEvent(new win.Event('input',{bubbles:true}));select.dispatchEvent(new win.Event('change',{bubbles:true}));sync();input.focus();}
  function highlight(index){active=index;buttons.forEach((button,i)=>button.setAttribute('aria-selected',String(i===index)));if(index>=0){input.setAttribute('aria-activedescendant',buttons[index].id);buttons[index].scrollIntoView?.({block:'nearest'})}else input.removeAttribute('aria-activedescendant');}
  function show(query=''){
    open=true;list.hidden=false;input.setAttribute('aria-expanded','true');toggle.setAttribute('aria-expanded','true');
    const words=normalize(query).split(' ').filter(Boolean);
    items=[...select.options].filter(option=>option.value&&words.every(word=>normalize(option.textContent+' '+(option.dataset.search||'')).includes(word)));
    list.replaceChildren();buttons=items.map((option,i)=>{const button=doc.createElement('button');button.type='button';button.id=list.id+'-'+i;button.className='search-select-option';button.setAttribute('role','option');button.textContent=option.textContent;button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(option);list.append(button);return button});
    if(!items.length){const empty=doc.createElement('p');empty.textContent='Ничего не найдено. Попробуйте другое название.';list.append(empty)}
    status.textContent=items.length?'Вариантов: '+items.length:'Ничего не найдено';highlight(-1);
  }
  input.onfocus=()=>{editing=false;show()};input.onclick=()=>{if(!open)show()};
  input.oninput=()=>{editing=true;show(input.value)};
  input.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open)show();highlight(Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowDown'?1:-1))))}else if(e.key==='Enter'&&open){e.preventDefault();if(items[active]||items.length===1)choose(items[active]||items[0])}else if(e.key==='Escape'){e.preventDefault();close()}};
  toggle.onclick=()=>{if(open)close();else{input.focus();show()}};
  wrap.onfocusout=e=>{if(!wrap.contains(e.relatedTarget))close()};
  select.addEventListener('focus',()=>input.focus());select.addEventListener('input',sync);select.addEventListener('change',sync);
  const api={sync,close,input};controls.set(select,api);sync();return api;
}
export function syncSearchableSelect(select){controls.get(select)?.sync()}
