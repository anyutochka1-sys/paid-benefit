// Keep the original month controls and YYYY-MM model/draft values intact.
// The two native selects have the same Russian month names on every phone.
const monthNames=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const controls=new WeakMap();

export function enhanceMonthInputs(root) {
  const document=root.ownerDocument||root,window=document.defaultView;
  for(const input of root.querySelectorAll('input[type="month"]')) {
    let control=controls.get(input);
    if(!control) {
      const group=document.createElement('span');group.className='month-picker';group.setAttribute('role','group');
      const title=(input.closest('label')?.firstChild?.textContent||'Период').trim();group.setAttribute('aria-label',title);
      const month=document.createElement('select'),year=document.createElement('select');
      month.className='month-picker-month';year.className='month-picker-year';
      month.setAttribute('aria-label','Месяц: '+title);year.setAttribute('aria-label','Год: '+title);
      month.add(new window.Option('Месяц',''));
      monthNames.forEach((name,index)=>month.add(new window.Option(name,String(index+1).padStart(2,'0'))));
      year.add(new window.Option('Год',''));
      const currentYear=new Date().getFullYear();
      for(let value=currentYear+5;value>=1990;value--)year.add(new window.Option(String(value),String(value)));
      input.before(group);group.append(input,month,year);
      input.classList.add('month-model');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
      input.focus=options=>month.focus(options);
      input.scrollIntoView=options=>group.scrollIntoView(options);
      control={group,month,year,lastValue:undefined};controls.set(input,control);
      const change=()=>{
        input.value=month.value&&year.value?year.value+'-'+month.value:'';
        control.lastValue=input.value;
        input.dispatchEvent(new window.Event('input',{bubbles:true}));
        input.dispatchEvent(new window.Event('change',{bubbles:true}));
      };
      month.addEventListener('change',change);year.addEventListener('change',change);
      input.addEventListener('input',()=>sync(input,control));
    }
    sync(input,control);
  }
}

function sync(input,control) {
  const {group,month,year}=control;
  if(input.value!==control.lastValue) {
    const [yearValue,monthValue]=(input.value||'').split('-');
    if(yearValue&&![...year.options].some(option=>option.value===yearValue))year.add(new input.ownerDocument.defaultView.Option(yearValue,yearValue));
    month.value=monthValue||'';year.value=yearValue||'';control.lastValue=input.value;
  }
  month.disabled=year.disabled=input.disabled;
  group.classList.toggle('field-invalid',input.getAttribute('aria-invalid')==='true');
  month.setAttribute('aria-invalid',input.getAttribute('aria-invalid')||'false');
  year.setAttribute('aria-invalid',input.getAttribute('aria-invalid')||'false');
}
