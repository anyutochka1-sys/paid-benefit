// Resolve an asset owner against the family composition on the filing date.
// A child's ownership must not be inferred from an applicant-owned object.
export function familyAssets(items,members,{includeWardIncome=false}={}) {
  const included=new Map(members.included.map(person=>[person.id,person]));
  const unanswered=new Set(members.unanswered.map(entry=>entry.person.id));
  const selected=[];
  let needsReview=false;
  for(const item of items) {
    if(item.owner==='applicant') {selected.push(item);continue}
    if(item.owner==='spouse') {
      if(members.included.some(person=>person.role==='spouse'))selected.push(item);
      else if(members.unanswered.some(entry=>entry.person.role==='spouse'))needsReview=true;
      continue;
    }
    if(item.owner?.startsWith('child:')) {
      const id=item.owner.slice(6);
      if(unanswered.has(id)) {needsReview=true;continue}
      const child=included.get(id);
      if(child)selected.push({...item,wardOwned:includeWardIncome?item.wardOwned:item.wardOwned||child.role==='ward'});
      else if(!members.excluded.some(entry=>entry.person.id===id))needsReview=true;
      continue;
    }
    needsReview=true;
  }
  return {items:selected,needsReview};
}
