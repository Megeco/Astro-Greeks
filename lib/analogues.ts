export type HistoryRow={date:string;P:number;E:number;V:number;close:number|null};
export type Scores={date:string;P:number;E:number;V:number};
export type Analogue={row:HistoryRow;index:number;distance:number;returns:Record<number,number>;path:number[];pathRows:HistoryRow[];worst:number};
export function findAnalogues(rows:HistoryRow[],target:Scores,tolerance:number,horizon:number,start:string,end:string,limitDate:string){
 if(![target.P,target.E,target.V,tolerance].every(Number.isFinite)||tolerance<0||![5,10,20].includes(horizon))throw Error('Invalid comparison settings.');
 const market=rows.filter(r=>r.close!==null&&r.close>0&&r.date<limitDate).sort((a,b)=>a.date.localeCompare(b.date));
 const candidates:Analogue[]=[];
 for(let i=0;i+horizon<market.length;i++){
  const r=market[i];if(r.date<start||r.date>end||market[i+horizon].date>=target.date)continue;
  const distance=Math.sqrt(((r.P-target.P)**2+(r.E-target.E)**2+(r.V-target.V)**2)/3);if(distance>tolerance)continue;
  const returns:Record<number,number>={};for(const h of [5,10,20])if(i+h<market.length&&market[i+h].date<target.date)returns[h]=100*(market[i+h].close!/r.close!-1);
  const pathRows=market.slice(i,i+horizon+1),path=pathRows.map(x=>100*(x.close!/r.close!-1));
  candidates.push({row:r,index:i,distance,returns,path,pathRows,worst:Math.min(0,...path)});
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.row.date.localeCompare(b.row.date));
 const matches:Analogue[]=[];for(const c of candidates)if(matches.every(m=>Math.abs(m.index-c.index)>horizon))matches.push(c);
 return {matches,candidates:candidates.length};
}
