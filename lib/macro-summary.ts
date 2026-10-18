export type DailyMacro = {date:string; P:number; E:number; V:number};
export function summarizeMonths(rows: DailyMacro[]) {
  const grouped = new Map<string, DailyMacro[]>();
  for (const r of [...rows].sort((a,b)=>a.date.localeCompare(b.date))) { const key=r.date.slice(0,7); grouped.set(key,[...(grouped.get(key)||[]),r]); }
  return [...grouped].map(([month, days]) => {
    const first=days[0],last=days.at(-1)!;
    const max = (key:'P'|'E'|'V') => days.reduce((a,b)=>b[key]>a[key]?b:a);
    const pressure=max('P'),expansion=max('E'),volatility=max('V');
    return {month,first,last,count:days.length,pressure,expansion,volatility,zeroExpansion:days.filter(r=>r.E===0).length,
      read:`Pressure peaks at ${pressure.P} on ${pressure.date}; expansion peaks at ${expansion.E} on ${expansion.date}. By ${last.date}, pressure is ${last.P}, expansion ${last.E} and macro V ${last.V}.`};
  });
}
export function keyMacroDates(rows:DailyMacro[]) {
  const result=new Map<string,{row:DailyMacro; reasons:string[]}>();
  const add=(row:DailyMacro,reason:string)=>{const old=result.get(row.date);result.set(row.date,{row,reasons:[...(old?.reasons||[]),reason]});};
  if(rows.length){add(rows[0],'Window starts');add(rows.at(-1)!,'Window ends');}
  for(const m of summarizeMonths(rows)){add(m.pressure,'Monthly pressure maximum');add(m.expansion,'Monthly expansion maximum');add(m.volatility,'Monthly macro V maximum');}
  return [...result.values()].sort((a,b)=>a.row.date.localeCompare(b.row.date));
}
